# OpsMemory Production Architecture & Design

> **"Your DevOps agent that remembers what your team learned."**

OpsMemory is a production-grade DevOps intelligence platform connecting to source control and CI/CD pipelines (GitHub & GitLab), observing deployments, investigating failures using current evidence and long-term organizational memory, and continuously learning from engineer corrections using Hindsight.

---

## 1. System Architecture Diagram

```mermaid
flowchart TD
    subgraph External_Providers ["CI/CD & Source Control Providers"]
        GH["GitHub (Actions, PRs, Commits, Diffs)"]
        GL["GitLab (Pipelines, MRs, Jobs, Logs)"]
    end

    subgraph Ingestion_Layer ["Webhook & Event Ingestion Layer"]
        WH_GH["/api/webhooks/github"]
        WH_GL["/api/webhooks/gitlab"]
        HMAC["HMAC / Token Signature Verification"]
        IDEMP["Idempotency & Deduplication Engine"]
        NORM["DevOps Provider Normalizer"]
        QUEUE["Async Background Task Queue"]
    end

    GH -->|Webhook Payload| WH_GH
    GL -->|Webhook Payload| WH_GL
    WH_GH --> HMAC
    WH_GL --> HMAC
    HMAC --> IDEMP
    IDEMP --> NORM
    NORM --> QUEUE

    subgraph Core_Intelligence ["OpsMemory Intelligence Engine (LangGraph + Groq + Hindsight)"]
        QUEUE --> L1["1. Load Incident & Telemetry"]
        L1 --> L2["2. Failure Fingerprint Engine"]
        L2 --> L3["3. Hindsight Organizational Recall"]
        L3 --> L4["4. Collect Current Evidence (Logs / Diffs)"]
        L4 --> L5["5. Check Historical Human Corrections"]
        L5 --> L6["6. Groq LLM Diagnostic Reasoning"]
        L6 --> L7["7. Human-in-the-Loop Review Console"]
        
        L7 -->|Engineer Confirms / Corrects| L8["8. Resolution & Outcome Evaluation"]
        L8 --> L9["9. Hindsight Organizational Retain"]
    end

    subgraph State_Storage ["Dual Persistence & Memory Architecture"]
        PG["PostgreSQL Database (Users, Orgs, Repos, Deployments, Incidents, Audit)"]
        HS["Hindsight Persistent Memory (Tenant-Isolated Organizational Bank)"]
    end

    L1 <-->|Read / Write State| PG
    L3 <-->|Recall Prior Learnings| HS
    L9 -->|Retain Root Cause & Fix| HS
```

---

## 2. Architectural Separation of Concerns

1. **PostgreSQL Relational State**:
   - Stores deterministic relational entities: Multi-tenant Organizations, Users, Integrations, Repositories, Deployments, Incidents, Pipeline Runs, and Audit Logs.
   - Foreign keys, indexes, and strict timestamps ensure complete compliance and auditability.

2. **Hindsight Persistent Memory Layer**:
   - Maintains durable organizational intelligence across deployments and incidents.
   - Enforces multi-tenant namespace isolation (`bank_id = opsmemory-org-{org_id}`).
   - Stores engineer corrections, verified root causes, failure patterns, and remediation outcomes.

3. **DevOpsProvider Abstraction (`GitHubProvider` & `GitLabProvider`)**:
   - Converts proprietary GitHub and GitLab payloads into normalized internal models (`NormalizedRepository`, `NormalizedCommit`, `NormalizedPipelineRun`, `NormalizedWebhookPayload`).
   - Ensures the rest of OpsMemory has zero provider-specific coupling.

4. **LangGraph Investigation Workflow**:
   - Coordinates multi-stage incident investigations with conditional human-in-the-loop branching (`confirm`, `correct`, `reject`).

5. **Groq LLM Reasoning**:
   - Fast inference over current telemetry and Hindsight historical memories to formulate root-cause hypotheses and confidence-scored remediations.

---

## 3. The Core Learning Loop

```
CI/CD PIPELINE FAILURE (GitHub / GitLab)
             ↓
WEBHOOK INGESTION & HMAC SIGNATURE VERIFICATION
             ↓
FAILURE FINGERPRINT ENGINE (e.g. PAYMENT_API_DB_POOL_PRODUCTION)
             ↓
HINDSIGHT MEMORY RECALL (Historical Corrections & Resolution Effectiveness)
             ↓
LANGGRAPH INVESTIGATION (Current Diffs + Pod Logs + Groq Synthesis)
             ↓
AI DIAGNOSIS PRESENTED TO ENGINEER
             ↓
ENGINEER CORRECTION ("Redis was only a symptom; DB pool exhaustion was root cause")
             ↓
RESOLUTION OUTCOME RECORDED (Increase DB pool size - 100% success)
             ↓
HINDSIGHT RETAIN (Stored into tenant memory bank)
             ↓
FUTURE SIMILAR FAILURE → INSTANT RECALL & ACCURATE FIRST-TIME DIAGNOSIS!
```
