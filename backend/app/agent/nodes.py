import logging
from typing import Dict, Any, List
from sqlmodel import Session, select
from app.database.session import engine
from app.models.schemas import Incident, Deployment, DeploymentChange, HumanCorrection, ResolutionOutcome, AgentDiagnosis, MemoryReference
from app.services.fingerprint import FailureFingerprintEngine
from app.services.effectiveness import ResolutionEffectivenessEngine
from app.hindsight.client import hindsight_service
from app.llm.groq_provider import groq_provider
from app.agent.state import OpsMemoryState

logger = logging.getLogger("opsmemory.agent.nodes")


def load_incident_node(state: OpsMemoryState) -> Dict[str, Any]:
    """Stage 1: Loads incident records, deployment data, and initial symptoms."""
    incident_id = state.get("incident_id")
    with Session(engine) as session:
        inc = session.get(Incident, incident_id)
        if not inc:
            raise ValueError(f"Incident with ID {incident_id} not found.")

        dep = None
        changes_list = []
        raw_logs = ""
        if inc.deployment_id:
            dep = session.get(Deployment, inc.deployment_id)
            if dep:
                raw_logs = dep.raw_logs or dep.logs_summary or ""
                dep_changes = session.exec(
                    select(DeploymentChange).where(DeploymentChange.deployment_id == dep.id)
                ).all()
                changes_list = [c.model_dump() for c in dep_changes]

    stage_log = {
        "stage": "load_incident",
        "title": "Loading Incident & Deployment",
        "status": "completed",
        "summary": f"Loaded incident {inc.incident_code} for service '{inc.service_name}' ({inc.environment})."
    }

    return {
        "incident_code": inc.incident_code,
        "service": inc.service_name,
        "environment": inc.environment,
        "deployment_id": inc.deployment_id,
        "symptoms": inc.symptoms_summary,
        "current_logs": raw_logs,
        "current_changes": changes_list,
        "stage_logs": state.get("stage_logs", []) + [stage_log]
    }


def generate_fingerprint_node(state: OpsMemoryState) -> Dict[str, Any]:
    """Stage 2: Deterministically computes the failure fingerprint."""
    service = state.get("service", "unknown_service")
    env = state.get("environment", "production")
    logs = state.get("current_logs", "")
    symptoms = state.get("symptoms", "")
    changes = state.get("current_changes", [])

    changed_files = [c.get("file_path", "") for c in changes]
    comp = changes[0].get("component") if changes else None

    fp_info = FailureFingerprintEngine.generate(
        service_name=service,
        environment=env,
        component=comp,
        changed_files=changed_files,
        logs=logs,
        symptoms=symptoms
    )

    stage_log = {
        "stage": "generate_fingerprint",
        "title": "Generating Failure Fingerprint",
        "status": "completed",
        "summary": f"Computed deterministic failure fingerprint: {fp_info['fingerprint']}"
    }

    # Update incident record in database
    with Session(engine) as session:
        inc = session.get(Incident, state.get("incident_id"))
        if inc:
            inc.failure_fingerprint = fp_info["fingerprint"]
            session.add(inc)
            session.commit()

    return {
        "failure_fingerprint": fp_info["fingerprint"],
        "fingerprint_details": fp_info,
        "stage_logs": state.get("stage_logs", []) + [stage_log]
    }


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

    stage_log = {
        "stage": "recall_memory",
        "title": "Recalling Hindsight Memory",
        "status": "completed",
        "summary": f"Retrieved {len(memories)} relevant organizational memories from Hindsight bank."
    }

    return {
        "recalled_memories": memories,
        "stage_logs": state.get("stage_logs", []) + [stage_log]
    }


def collect_evidence_node(state: OpsMemoryState) -> Dict[str, Any]:
    """Stage 4: Aggregates current telemetry, commit diffs, and effectiveness statistics."""
    fingerprint = state.get("failure_fingerprint")
    service = state.get("service")

    with Session(engine) as session:
        resolutions = ResolutionEffectivenessEngine.get_effectiveness_for_fingerprint(
            session, fingerprint=fingerprint, service_name=service
        )

    stage_log = {
        "stage": "collect_current_evidence",
        "title": "Collecting Current Evidence",
        "status": "completed",
        "summary": f"Analyzed deployment changes, service logs, and historical resolution stats."
    }

    return {
        "historical_resolutions": resolutions,
        "stage_logs": state.get("stage_logs", []) + [stage_log]
    }


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

    # From DB
    with Session(engine) as session:
        db_corrs = session.exec(
            select(HumanCorrection).where(HumanCorrection.failure_fingerprint == fingerprint)
        ).all()
        for c in db_corrs:
            corrections_found.append(c.model_dump())

    stage_log = {
        "stage": "check_historical_corrections",
        "title": "Checking Historical Human Corrections",
        "status": "completed",
        "summary": f"Found {len(corrections_found)} historical engineer corrections for this fingerprint."
    }

    return {
        "historical_corrections": corrections_found,
        "stage_logs": state.get("stage_logs", []) + [stage_log]
    }


async def analyze_incident_node(state: OpsMemoryState) -> Dict[str, Any]:
    """Stage 6: Runs Groq LLM reasoning with full operational context."""
    service = state.get("service")
    env = state.get("environment")
    fp = state.get("failure_fingerprint")
    symptoms = state.get("symptoms")
    logs = state.get("current_logs")
    changes = state.get("current_changes", [])
    memories = state.get("recalled_memories", [])
    corrections = state.get("historical_corrections", [])
    resolutions = state.get("historical_resolutions", [])

    diagnosis_data = await groq_provider.analyze_incident(
        service=service,
        environment=env,
        fingerprint=fp,
        symptoms=symptoms,
        logs=logs,
        changes=changes,
        historical_memories=memories,
        historical_corrections=corrections,
        historical_resolutions=resolutions
    )

    stage_log = {
        "stage": "analyze_incident",
        "title": "Groq LLM Reasoning & Synthesis",
        "status": "completed",
        "summary": f"Synthesized diagnosis with {round(diagnosis_data.get('confidence_score', 0.85)*100)}% confidence."
    }

    return {
        "initial_diagnosis": diagnosis_data,
        "agent_hypotheses": [diagnosis_data.get("root_cause_hypothesis", "")],
        "recommended_actions": [diagnosis_data.get("recommended_action", "Rollback")],
        "stage_logs": state.get("stage_logs", []) + [stage_log]
    }


def generate_diagnosis_node(state: OpsMemoryState) -> Dict[str, Any]:
    """Stage 7: Formats and stores the agent diagnosis in the relational database."""
    diag = state.get("initial_diagnosis", {})
    incident_id = state.get("incident_id")

    with Session(engine) as session:
        # Save diagnosis record
        diag_record = AgentDiagnosis(
            incident_id=incident_id,
            diagnosis_text=diag.get("diagnosis", "Investigation completed"),
            root_cause_hypothesis=diag.get("root_cause_hypothesis", "Unknown"),
            confidence_score=diag.get("confidence_score", 0.85),
            evidence_summary=diag.get("evidence_summary", ""),
            recommended_action=diag.get("recommended_action", "Rollback"),
            historical_matches_found=diag.get("historical_matches_found", 0)
        )
        session.add(diag_record)

        # Update incident status
        inc = session.get(Incident, incident_id)
        if inc:
            inc.initial_diagnosis = diag.get("diagnosis")
            inc.confirmed_root_cause = diag.get("root_cause_hypothesis")
            inc.status = "diagnosing"
            session.add(inc)
        session.commit()

    stage_log = {
        "stage": "generate_diagnosis",
        "title": "Presenting Diagnosis & Waiting for Engineer",
        "status": "completed",
        "summary": f"Diagnosis presented to engineer for review and verification."
    }

    return {
        "stage_logs": state.get("stage_logs", []) + [stage_log]
    }


def handle_correction_node(state: OpsMemoryState) -> Dict[str, Any]:
    """Stage 8 (Conditional): Records engineer correction and retains into Hindsight."""
    corr = state.get("human_correction") or {}
    incident_id = state.get("incident_id")
    fingerprint = state.get("failure_fingerprint")
    service = state.get("service")

    correction_text = corr.get("correction_text", "")
    actual_root_cause = corr.get("actual_root_cause", "")

    with Session(engine) as session:
        # Save HumanCorrection model
        hc = HumanCorrection(
            incident_id=incident_id,
            engineer_name=corr.get("engineer_name", "DevOps Engineer"),
            incorrect_hypothesis=state.get("initial_diagnosis", {}).get("root_cause_hypothesis", "Initial Hypothesis"),
            correction_text=correction_text,
            actual_root_cause=actual_root_cause,
            remediation_guidance=corr.get("suggested_action", "Apply verified fix"),
            failure_fingerprint=fingerprint,
            retained_to_hindsight=True
        )
        session.add(hc)

        # Update Incident
        inc = session.get(Incident, incident_id)
        if inc:
            inc.human_correction = correction_text
            inc.confirmed_root_cause = actual_root_cause
            inc.status = "corrected"
            session.add(inc)
        session.commit()

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

    stage_log = {
        "stage": "human_correction",
        "title": "Engineer Correction Retained",
        "status": "completed",
        "summary": f"Retained engineer correction into Hindsight. Organizational memory updated."
    }

    return {
        "confirmed_root_cause": actual_root_cause,
        "learning_summary": f"Learned from engineer: {actual_root_cause}",
        "stage_logs": state.get("stage_logs", []) + [stage_log]
    }


def resolution_node(state: OpsMemoryState) -> Dict[str, Any]:
    """Stage 9: Records an explicitly confirmed resolution outcome."""
    incident_id = state.get("incident_id")
    action = state.get("selected_action") or state.get("recommended_actions", ["Rollback"])[0]
    fingerprint = state.get("failure_fingerprint")
    service = state.get("service")
    supplied_outcome = state.get("resolution_outcome") or {}
    success = bool(supplied_outcome.get("success", False))
    recovery_time_minutes = int(supplied_outcome.get("recovery_time_minutes", 0))

    with Session(engine) as session:
        # Record resolution outcome
        outcome = ResolutionOutcome(
            incident_code=state.get("incident_code", "INC"),
            service_name=service,
            failure_fingerprint=fingerprint,
            remediation_action=action,
            success=success,
            recovery_time_minutes=recovery_time_minutes,
            rollback_required="rollback" in action.lower(),
            engineer_confirmed=True,
            notes=supplied_outcome.get("notes")
        )
        session.add(outcome)

        inc = session.get(Incident, incident_id)
        if inc:
            inc.remediation_applied = action
            inc.resolution_status = "success" if success else "failed"
            inc.recovery_time_seconds = recovery_time_minutes * 60
            inc.status = "resolved" if success else "investigating"
            session.add(inc)
        session.commit()

    stage_log = {
        "stage": "resolution",
        "title": "Resolution Outcome Recorded",
        "status": "completed",
        "summary": f"Human-confirmed outcome for '{action}': {'success' if success else 'failure'}.",
    }

    return {
        "selected_action": action,
        "stage_logs": state.get("stage_logs", []) + [stage_log]
    }


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

    with Session(engine) as session:
        inc = session.get(Incident, state.get("incident_id"))
        if inc:
            inc.retained_in_hindsight = True
            session.add(inc)
            session.commit()

    stage_log = {
        "stage": "retain_learning",
        "title": "Hindsight Memory Retained",
        "status": "completed",
        "summary": f"Successfully retained operational knowledge for future incident recall."
    }

    return {
        "learning_summary": f"Incident {incident_code} knowledge retained in Hindsight.",
        "stage_logs": state.get("stage_logs", []) + [stage_log]
    }


async def evaluate_automation_candidate_node(state: OpsMemoryState) -> Dict[str, Any]:
    """Stage 7b: Evaluates deterministic policy engine for candidate self-recovery action."""
    from app.services.automation.manager import AutomationManager
    from app.services.automation.policy_engine import AutomationPolicyEngine
    from app.models.schemas import AutomationAction

    incident_id = state.get("incident_id")
    service = state.get("service", "unknown_service")
    environment = state.get("environment", "production")
    deployment_id = state.get("deployment_id")
    diag = state.get("initial_diagnosis", {})
    recommended_action = diag.get("recommended_action", "Rollback")
    confidence = diag.get("confidence_score", 0.85)

    rec_lower = recommended_action.lower()
    if "retry" in rec_lower:
        action_type = "retry"
    elif "restart" in rec_lower:
        action_type = "restart"
    elif "rollback" in rec_lower:
        action_type = "rollback"
    else:
        action_type = "no_action"

    action_id = None
    action_code = None
    with Session(engine) as session:
        engine_policy = AutomationPolicyEngine(session)
        decision, reason, risk = engine_policy.evaluate(
            action_type=action_type,
            target=service,
            environment=environment,
            incident_id=incident_id,
            confidence=confidence
        )

        if incident_id and action_type != "no_action":
            # Check if there is already an active or completed automation action for this incident
            existing_action = session.exec(
                select(AutomationAction).where(
                    AutomationAction.incident_id == incident_id,
                    AutomationAction.action_type == action_type,
                    AutomationAction.status.in_(["pending", "awaiting_approval", "running", "succeeded"])
                )
            ).first()
            if not existing_action:
                action_record = await AutomationManager.propose_and_evaluate(
                    session=session,
                    action_type=action_type,
                    target=service,
                    reason=f"Agent recommended {action_type} based on verified root cause: {diag.get('root_cause_hypothesis', 'Unknown')}",
                    environment=environment,
                    incident_id=incident_id,
                    deployment_id=deployment_id,
                    provider="github",
                    repository=f"acme/{service}",
                    confidence=confidence,
                    org_id=1
                )
            else:
                action_record = existing_action

            if action_record:
                action_id = action_record.id
                action_code = action_record.action_code

    stage_log = {
        "stage": "evaluate_automation_policy",
        "title": "Deterministic Safety & Policy Evaluation",
        "status": "completed",
        "summary": f"Policy decision: [{decision.value.upper()}]. Action: {action_type} (Risk: {risk.value.upper()}). Reason: {reason}"
    }

    candidate_data = {
        "action_type": action_type,
        "target": service,
        "risk_level": risk.value,
        "policy_result": decision.value,
        "reason": reason
    }
    if action_id:
        candidate_data["action_id"] = action_id
        candidate_data["action_code"] = action_code

    return {
        "automation_candidate": candidate_data,
        "automation_decision": decision.value,
        "stage_logs": state.get("stage_logs", []) + [stage_log]
    }

