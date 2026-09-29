# Hindsight Turned Incident History into an Input, Not an Archive

The first diagnosis of a deployment failure is often plausible, specific, and wrong. In this system, a Redis timeout can be the visible symptom of a database connection pool that has been exhausted. If the next investigation starts from the same symptom and has no memory of the correction, an engineer—or an agent—can repeat the same mistake.

I built OpsMemory around a narrower goal than “give an agent memory”: make a previous, verified incident change the evidence available during the next investigation. Hindsight is the part that carries that experience from one run to another.

## What I built

OpsMemory is a DevOps incident investigation service. Webhooks from GitHub or GitLab enter a FastAPI backend, where provider-specific payloads are normalized into internal deployment and pipeline models. PostgreSQL stores the operational record: organizations, deployments, incidents, corrections, resolutions, and audit data. A React console exposes the investigation stages and gives an engineer a place to confirm or correct the diagnosis.

The investigation itself is a LangGraph workflow. It loads the incident, computes a deterministic failure fingerprint, recalls organizational memory, collects current evidence, checks historical corrections, asks a Groq-backed reasoning provider for a diagnosis, and then pauses for human review. A correction or confirmed resolution is retained as new experience.

That separation matters. PostgreSQL is the system of record for relational state. Hindsight is the organizational memory bank: the place where a verified root cause and the remediation that followed can be recalled in a later incident.

## The problem was not remembering logs

The obvious implementation would have been to send the current logs and deployment diff to the model and ask for a root cause. That works for a single investigation, but it loses the most valuable part of incident response: the explanation an engineer supplied after seeing the initial diagnosis fail.

The workflow makes that distinction explicit. Before asking the model to reason, it generates a normalized fingerprint from the service, environment, component, changed files, logs, and symptoms. For example, a failure may become `PAYMENT_API_DB_POOL_PRODUCTION`, with a separate category such as `DB_POOL_EXHAUSTION`.

The fingerprint is deliberately deterministic. It gives memory retrieval a stable operational key instead of relying on a model to decide whether two incidents feel similar. It is also not treated as the diagnosis. The fingerprint identifies the shape of the incident; current evidence and historical experience still have to explain it.

Here is the relevant part of the fingerprint engine:

```python name=backend/app/services/fingerprint.py url=https://github.com/AnikethVuruputuri/MicrosoftHackathon/blob/main/backend/app/services/fingerprint.py#L84-L105
        norm_comp = cls.extract_component(norm_service, component, log_str, c_files)
        
        if not error_category:
            norm_cat = cls.extract_error_category(log_str, sym_str)
        else:
            norm_cat = cls.normalize_string(error_category)

        # Primary deterministic fingerprint string
        # e.g., PAYMENT_API_DB_POOL_PRODUCTION
        raw_fingerprint = f"{norm_service}_{norm_comp}_{norm_env}"
        
        # High precision hash for exact match identification
        detail_hash = hashlib.sha256(f"{raw_fingerprint}_{norm_cat}".encode()).hexdigest()[:10]

        return {
            "fingerprint": raw_fingerprint,
            "hash": detail_hash,
            "service": norm_service,
            "environment": norm_env,
            "component": norm_comp,
            "category": norm_cat,
            "display": f"{raw_fingerprint} ({norm_cat})"
        }
```

One subtle design choice is visible here: the readable fingerprint and the high-precision hash are both produced, but the investigation’s Hindsight query uses the readable fingerprint. That keeps memory references understandable to engineers while preserving a more precise discriminator for the system to use as the implementation evolves. A memory key should help humans debug the debugger; it should not be an opaque embedding identifier.

## The first encounter: useful, but incomplete

Consider the incident path described by the application’s demo data. `payment-api` starts returning 504s after a deployment. Logs mention Redis connection timeouts. The current deployment changes and symptoms are loaded into graph state. The fingerprint engine identifies the service, environment, component, and error category. At this point there is no prior correction to recall.

The graph then asks Hindsight for memories using the service and fingerprint, tags the results, and stores references to the returned memories in PostgreSQL. The memories are not the final answer; they become another input to the reasoning stage.

```python name=backend/app/agent/nodes.py url=https://github.com/AnikethVuruputuri/MicrosoftHackathon/blob/main/backend/app/agent/nodes.py#L96-L130
def recall_memory_node(state: OpsMemoryState) -> Dict[str, Any]:
    """Stage 3: Queries Hindsight persistent organizational memory for historical matches."""
    service = state.get("service")
    fingerprint = state.get("failure_fingerprint")
    
    query = f"{service} {fingerprint} incident root cause correction"
    tags = [service.lower(), fingerprint.lower()]

    memories = hindsight_service.recall(query=query, tags=tags, limit=5)
    
    # Store memory references in database
    with Session(engine) as session:
        for m in memories:
            ref = MemoryReference(
                incident_id=state.get("incident_id"),
                memory_id=str(m.get("id")),
                memory_type=m.get("memory_type", "incident"),
                relevance_score=0.95,
                source=m.get("source", "hindsight"),
                content_snippet=m.get("contents", "")[:300]
            )
            session.add(ref)
        session.commit()
```

The first diagnosis can therefore remain a hypothesis: perhaps Redis is unhealthy, perhaps the deployment changed connection behavior, perhaps the 504 is downstream of another dependency. The engineer can confirm it, reject it, or correct it.

That human correction is the important write path. When the engineer says that Redis is only a symptom and the actual root cause is PostgreSQL pool exhaustion, the system stores the correction in PostgreSQL and retains a structured memory in Hindsight. The memory includes the fingerprint, the incorrect hypothesis, the verified root cause, and metadata marking it as corrected.

```python name=backend/app/agent/nodes.py url=https://github.com/AnikethVuruputuri/MicrosoftHackathon/blob/main/backend/app/agent/nodes.py#L306-L323
    # Retain into Hindsight
    retain_content = (
        f"Engineer Correction on {service} [{fingerprint}]: "
        f"AI initially diagnosed '{state.get('initial_diagnosis', {}).get('root_cause_hypothesis')}'. "
        f"Engineer corrected: '{correction_text}'. "
        f"Actual verified root cause: '{actual_root_cause}'."
    )
    hindsight_service.retain(
        contents=retain_content,
        memory_type="human_correction",
        tags=[service.lower(), fingerprint.lower(), "human_correction"],
        metadata={
            "incident_id": incident_id,
            "failure_fingerprint": fingerprint,
            "actual_root_cause": actual_root_cause,
            "is_corrected": True
        }
    )
```

This is more valuable than retaining a raw transcript. The retained fact says what the model got wrong and what an engineer verified. It is experience, not merely history.

## The second encounter: memory changes the reasoning context

When a similar `payment-api` failure arrives later, the execution path is the same until recall. The fingerprint and tags point Hindsight at the previous incident. The workflow then filters recalled memories for `human_correction`, `engineering_knowledge`, or correction metadata and passes those corrections to the reasoning provider alongside the new logs and changes.

```python name=backend/app/agent/nodes.py url=https://github.com/AnikethVuruputuri/MicrosoftHackathon/blob/main/backend/app/agent/nodes.py#L156-L190
def check_historical_corrections_node(state: OpsMemoryState) -> Dict[str, Any]:
    """Stage 5: Inspects organizational memory specifically for engineer corrections."""
    fingerprint = state.get("failure_fingerprint")
    recalled = state.get("recalled_memories", [])
    
    # Check both recalled Hindsight memories and database records
    corrections_found = []
    
    # From Hindsight memories
    for m in recalled:
        if m.get("memory_type") in ["human_correction", "engineering_knowledge"] or m.get("metadata", {}).get("is_corrected"):
            corrections_found.append({
                "source": "hindsight",
                "contents": m.get("contents"),
                "actual_root_cause": m.get("metadata", {}).get("actual_root_cause", m.get("contents")),
                "remediation": m.get("metadata", {}).get("remediation")
            })
```

The model is still given current evidence. Memory does not replace the current deployment diff or logs. Instead, it changes the question the model is able to ask: “Does this look like the earlier Redis symptom hiding database pool exhaustion, or is the current deployment materially different?”

The graph makes the causal chain visible:

`current incident → deterministic fingerprint → Hindsight recall → current evidence plus prior correction → diagnosis → human review → outcome → retained learning`

Without the memory step, the second investigation starts from the same misleading symptom. With it, the previous correction becomes part of the reasoning context before the recommendation is generated.

## Similar symptoms are not permission to replay a fix

The system intentionally keeps human review in the loop. A recalled correction influences diagnosis, but it does not directly execute the old remediation. The graph routes the generated diagnosis through a review branch, and a correction teaches the system without proving that a fix was applied. Only a separately recorded resolution outcome establishes whether the selected action succeeded.

That distinction is reinforced by the resolution-effectiveness service. It groups recorded actions by fingerprint or service, calculates success rates and average recovery time, and marks an action as recommended only when its success rate reaches the configured threshold of 80 percent. Historical memory supplies narrative context; resolution records supply outcome evidence.

This is the nuance I would have missed if I had treated Hindsight as a simple cache. A memory can be relevant and still be unsafe to copy blindly. The current failure may share a fingerprint but differ in deployment changes, environment, or failure category. The engineer remains the gate, and the resolution record is what turns an attempted action into evidence for future decisions.

The final learning write also retains the complete incident-to-resolution relationship:

```python name=backend/app/agent/nodes.py url=https://github.com/AnikethVuruputuri/MicrosoftHackathon/blob/main/backend/app/agent/nodes.py#L386-L415
def retain_learning_node(state: OpsMemoryState) -> Dict[str, Any]:
    """Stage 10: Persists the complete incident-to-resolution learning loop into Hindsight."""
    incident_code = state.get("incident_code")
    service = state.get("service")
    fp = state.get("failure_fingerprint")
    root_cause = state.get("confirmed_root_cause") or state.get("initial_diagnosis", {}).get("root_cause_hypothesis", "Unknown")
    action = state.get("selected_action", "Rollback")
    correction = state.get("human_correction", {}).get("correction_text") if state.get("human_correction") else None

    # Retain full engineering knowledge
    content = (
        f"Deployment Incident {incident_code} for {service} [Fingerprint: {fp}]. "
        f"Root cause was verified as: {root_cause}. "
        f"Effective remediation action: {action}. "
        f"Learning note: Redis connection failures on {service} indicate database pool exhaustion."
    )
    
    hindsight_service.retain(
        contents=content,
        memory_type="engineering_knowledge",
        tags=[service.lower(), fp.lower(), "resolution_learning"],
        metadata={
            "incident_code": incident_code,
            "service": service,
            "failure_fingerprint": fp,
            "root_cause": root_cause,
            "remediation": action,
            "has_human_correction": bool(correction)
        }
    )
```

The client also isolates memories by organization bank, and it has a local persistent JSON store when the official Hindsight client or credentials are unavailable. That fallback is intentionally simple, but it preserves the same retain/recall contract and makes the workflow searchable in demo and local environments. The important abstraction is not the storage mechanism; it is that the investigation treats retained experience as durable state rather than as text stuffed into the next prompt.

## Three concrete behaviors

**First encounter.** `payment-api` emits 504s and Redis timeout messages. The fingerprint is generated, current evidence is collected, and the model produces a surface-level Redis hypothesis. An engineer corrects it to PostgreSQL connection pool exhaustion. The correction and eventual remediation are retained.

**Later similar encounter.** The same service and fingerprint are seen again. Hindsight recalls the correction, the workflow identifies it as verified historical knowledge, and the reasoning input now includes the earlier distinction between symptom and cause. The resulting diagnosis can start with pool exhaustion as a supported hypothesis instead of rediscovering the mistake.

**Similar symptom, different case.** Another service reports a timeout, but its fingerprint, changed files, environment, or current logs differ. The old memory may be retrieved if the query overlaps, but it is not an automatic action. Current evidence, historical resolution statistics, policy checks, and human review still determine whether the old remediation applies.

## Lessons I would reuse

1. **Give memories a deterministic retrieval handle.** A normalized service/component/environment fingerprint makes recall inspectable and debuggable. It is easier to reason about than an unbounded “find something similar” prompt.

2. **Store corrections, not just conversations.** The useful artifact was not that an incident occurred; it was that an engineer identified where the initial hypothesis was wrong and recorded the verified cause.

3. **Keep memory and current evidence separate.** Hindsight provides prior experience. Logs, diffs, and deployment state establish what is happening now. Combining them at reasoning time is safer than allowing either one to replace the other.

4. **Record outcomes independently from diagnoses.** A recommended action is not a successful remediation. The system retains resolution outcomes so future recommendations can use observed effectiveness rather than confidence alone.

5. **Treat memory as a decision input, not an execution command.** Persistent memory can make an agent improve through experience, but it should not turn a previous fix into a rule that bypasses review.

For the Hindsight integration itself, the useful concepts are documented in the [Hindsight repository](https://github.com/vectorize-io/hindsight) and the [Hindsight documentation](https://hindsight.vectorize.io/). The broader distinction between storing context and building agent memory is also covered by [Vectorize’s overview of agent memory](https://vectorize.io/what-is-agent-memory).

The result is not an agent that magically knows the answer. It is an investigation workflow that can remember being wrong, preserve the engineer’s correction, and use that experience the next time the same misleading symptom appears.
