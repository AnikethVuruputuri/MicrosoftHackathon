# OpsMemory Live Demo Script (60–90 Seconds)

**Central Product Idea**: "OpsMemory doesn't just remember incidents. It remembers what engineers learned from those incidents."

---

## ⏱️ Demo Flow:

### 0–15 Seconds: The Dashboard & Problem
1. Open the OpsMemory UI at `http://localhost:5173`.
2. Point out:
   - **System Observability Bar**: Real-time status for Groq, Hindsight, Database, and Backend.
   - **Recent Incidents**: Observe active deployment failures.
   - **Historical Risk Indicator**: Shows why database pool adjustments are marked as high risk based on organizational history.

---

### 15–35 Seconds: Round 1 – Initial AI Diagnosis (INC-101)
1. Click **"1. Open INC-101"** (or select `INC-101` from the Incidents list).
2. Note the symptoms: `payment-api` checkout errors, Redis connection timeout, 504 Gateway errors.
3. Click **"Investigate with OpsMemory"**.
4. Watch the 10-stage LangGraph workflow execute:
   - Fingerprint computed: `PAYMENT_API_DB_POOL_PRODUCTION`
   - Hindsight recall queries organizational bank
   - Groq reasons over error logs
5. The Agent outputs its initial diagnosis:
   > *"Surface log analysis indicates Redis connection timeout and socket errors. Recommended: Flush Redis cache & restart cluster."*

---

### 35–55 Seconds: Human in the Loop – Engineer Teaches OpsMemory
1. Click **"Correct AI Diagnosis"** (or **"2. Teach Agent"**).
2. Enter the SRE correction:
   - **Correction Note**: *"Redis is only a downstream symptom. The actual root cause is PostgreSQL connection pool exhaustion."*
   - **Actual Root Cause**: `PostgreSQL connection pool exhaustion`
   - **Suggested Remediation**: `Increase DB pool size from 20 to 100`
3. Click **"Save Correction & Retain to Hindsight"**.
4. Observe:
   - LangGraph routes through `handle_correction` -> `resolution` -> `retain_learning`.
   - The green confirmation appears: *"Learning retained into Hindsight bank (opsmemory-demo)."*
   - The Learning Timeline updates to record this organizational knowledge.

---

### 55–80 Seconds: Round 2 – The AI Remembers (Verification)
1. Go to **"Simulate Release"** (or click **"3. Verify Learned SRE"**).
2. Click **"Simulate Release Rollout"** (with `payment-api` and `Database Config`).
3. A new incident is triggered with the same fingerprint (`PAYMENT_API_DB_POOL_PRODUCTION`).
4. Click **"Investigate with OpsMemory"**.
5. Watch the LangGraph agent run again:
   - Recalls the previous engineer correction from Hindsight!
   - Groq receives the recalled memory context.
6. The Agent now diagnoses:
   > *"Recall match from Hindsight memory: A previous incident with fingerprint PAYMENT_API_DB_POOL_PRODUCTION was initially diagnosed as Redis failure, but an engineer corrected it to PostgreSQL connection pool exhaustion. Redis timeout is a downstream symptom."*
   - **Root Cause Hypothesis**: `PostgreSQL connection pool exhaustion (confirmed by historical human correction)`
   - **Recommended Action**: `Increase DB connection pool size from 20 to 100 (100% historical success rate)`

---

### 80–90 Seconds: Memory Explorer
1. Navigate to **"Memory Explorer"**.
2. Show the retained organizational memory ledger, tags, and timeline.
3. Use the **"Hindsight Reflect"** bar to ask:
   *"What have we learned from previous database connection pool exhaustion incidents?"*
4. Show the comprehensive reflection synthesized from past team discoveries.

---

## 🎯 Key Takeaway
"The AI remembered that it was wrong last time, avoided repeating the mistake, and applied the exact fix verified by human engineers."
