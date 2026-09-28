# OpsMemory

> **"Your DevOps agent that remembers what your team learned."**

[![CI/CD](https://img.shields.io/badge/CI%2FCD-Passing-emerald)](#)
[![Python](https://img.shields.io/badge/Python-3.11+-blue)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688)](#)
[![React](https://img.shields.io/badge/React-18-61DAFB)](#)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2.50+-orange)](#)
[![Hindsight](https://img.shields.io/badge/Hindsight-Persistent%20Memory-purple)](#)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791)](#)

OpsMemory is a production-ready DevOps intelligence platform that connects to source control and CI/CD pipelines (GitHub & GitLab), observes deployments and workflow runs, investigates failures using current evidence and organizational memory, and continuously learns from deployment outcomes and engineer corrections using Hindsight.

---

## Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                            External CI/CD Providers                               |
|                     GitHub Actions   |   GitLab CI/CD                             |
+-----------------------------------------------------------------------------------+
                                         | (Webhooks / REST APIs)
                                         v
+-----------------------------------------------------------------------------------+
|                        DevOpsProvider Normalization Layer                         |
|     HMAC Signature Verification  |  Idempotency Engine  |  Normalized Event DTOs  |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                   OpsMemory SRE Intelligence Engine (LangGraph)                   |
|                                                                                   |
|  1. Load Incident & Telemetry                                                     |
|  2. Compute Failure Fingerprint (Service + Component + Error Signature)          |
|  3. Recall Organizational Memory (Hindsight Bank: opsmemory-org-{id})             |
|  4. Collect Current Evidence (Commit Diffs + Container Logs)                      |
|  5. Check Historical Human Corrections (Prior SRE Diagnoses)                      |
|  6. Groq LLM Diagnostic Reasoning & Evidence Synthesis                           |
|  7. Human-in-the-Loop Review Console (Engineer Confirms or Corrects)             |
|  8. Apply Remediation & Evaluate Recovery Outcome                                 |
|  9. Retain Operational Learning into Hindsight Persistent Memory                  |
+-----------------------------------------------------------------------------------+
         |                                                           |
         v                                                           v
+--------------------------------------+   +----------------------------------------+
|       PostgreSQL Relational DB       |   |       Hindsight Persistent Memory      |
|  Users, Orgs, Integrations, Repos,   |   |   Organizational Intelligence Bank,    |
|  Deployments, Incidents, Audit Trail |   |   Corrections, Patterns, Remediations  |
+--------------------------------------+   +----------------------------------------+
```

---

## Directory Structure

```
OpsMemory/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI/CD pipeline
├── backend/
│   ├── app/
│   │   ├── agent/                 # LangGraph workflow (state, nodes, edges, graph)
│   │   ├── api/                   # REST API routers (auth, integrations, webhooks, etc.)
│   │   ├── database/              # SQLModel engine session & seed scripts
│   │   ├── hindsight/             # Multi-tenant Hindsight memory client
│   │   ├── llm/                   # Groq LLM provider
│   │   ├── models/                # Database & Pydantic domain models
│   │   ├── services/
│   │   │   ├── providers/         # DevOpsProvider (GitHub & GitLab implementations)
│   │   │   ├── fingerprint.py     # Deterministic Failure Fingerprint Engine
│   │   │   ├── effectiveness.py   # Resolution Effectiveness Engine
│   │   │   ├── risk_engine.py     # Deployment Risk Engine
│   │   │   ├── queue.py           # Background async task queue
│   │   │   └── security.py        # Token encryption & JWT auth
│   │   ├── config.py              # Pydantic Settings
│   │   └── main.py                # FastAPI app initialization & lifecycle
│   ├── tests/                     # Unit, integration, provider, and webhook test suite
│   ├── Dockerfile                 # Backend production container
│   ├── pytest.ini                 # Pytest configuration
│   └── requirements.txt           # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/            # UI components (Navbar, StageTracker, Timeline, etc.)
│   │   ├── pages/                 # UI pages (Dashboard, Incidents, Integrations, Audit, etc.)
│   │   ├── services/              # API client methods
│   │   ├── types/                 # TypeScript type definitions
│   │   ├── App.tsx                # Main routing & state
│   │   └── main.tsx               # React entry point
│   ├── Dockerfile                 # Frontend production container (Nginx SPA)
│   ├── package.json               # Frontend dependencies & scripts
│   └── vite.config.ts             # Vite configuration
├── docs/
│   ├── architecture.md            # In-depth architectural design
│   └── demo-script.md             # Interactive SRE demo walkthrough
├── .env.example                   # Production environment configuration template
└── docker-compose.yml             # Full-stack Docker Compose deployment
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Core
PROJECT_NAME="OpsMemory"
VERSION="1.0.0"
DEMO_MODE=false
ENVIRONMENT="production"

# Security & Multi-Tenancy
JWT_SECRET="replace-with-a-secure-random-secret-key-at-least-32-chars"
ENCRYPTION_KEY="u6N1_4lVlY1QjS8q2hQ7gE4uW7jZ0rT3yA5dF8gH2kM="

# Database (PostgreSQL for production; SQLite for local development)
DATABASE_URL="postgresql://opsmemory:opsmemory_password@postgres:5432/opsmemory"
# DATABASE_URL="sqlite:///./opsmemory.db"

# Redis Task Queue
REDIS_URL="redis://redis:6379/0"

# Groq LLM Provider
GROQ_API_KEY="gsk_your_groq_api_key_here"
GROQ_MODEL="llama-3.3-70b-versatile"

# Hindsight Long-term Organizational Memory Layer
HINDSIGHT_API_KEY="hind_your_hindsight_api_key_here"
HINDSIGHT_BASE_URL="https://api.hindsight.vectorize.io"
HINDSIGHT_BANK_ID="opsmemory-demo"

# GitHub Integration
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"
GITHUB_WEBHOOK_SECRET="opsmemory-github-webhook-secret"

# GitLab Integration
GITLAB_CLIENT_ID="your_gitlab_client_id"
GITLAB_CLIENT_SECRET="your_gitlab_client_secret"
GITLAB_URL="https://gitlab.com"
GITLAB_WEBHOOK_SECRET="opsmemory-gitlab-webhook-secret"
```

---

## Database Schema

OpsMemory uses PostgreSQL (or SQLite locally) via SQLModel with indices, foreign keys, and audit timestamps:

- **`organizations`**: Multi-tenant organizations with isolated Hindsight bank namespaces (`opsmemory-org-{id}`).
- **`users`**: Multi-tenant users, roles (`admin`, `engineer`, `viewer`), and hashed credentials.
- **`integrations`**: Connected GitHub and GitLab provider accounts, encrypted OAuth access tokens, and webhook secrets.
- **`repositories`**: Onboarded code repositories, monitored branches (`main`), and target environments (`production`, `staging`).
- **`pipelines`** & **`pipeline_runs`**: CI/CD pipeline executions, commit SHAs, author metadata, conclusion, and raw logs.
- **`pipeline_jobs`**: Stage-level job telemetry and execution logs.
- **`deployments`** & **`deployment_changes`**: Release deployments, commit diff snippets, and configuration modifications.
- **`incidents`** & **`incident_events`**: SRE incidents, failure fingerprints, AI diagnoses, engineer corrections, and resolutions.
- **`agent_diagnoses`**: Structured AI root cause hypotheses, confidence scores, and recommended remediations.
- **`human_corrections`**: Verified engineer corrections recorded into both PostgreSQL and Hindsight.
- **`resolution_outcomes`**: Statistical recovery records (success rate, recovery duration, rollback flags).
- **`webhook_events`**: Idempotent webhook delivery tracking and processing status (`received`, `processing`, `processed`, `duplicate`).
- **`audit_logs`**: Immutable security and compliance audit trail.

---

## REST API Endpoint Summary

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Basic application health check |
| `/api/system/ready` | GET | Comprehensive readiness check (DB, Hindsight, LLM, Providers) |
| `/api/system/status` | GET | Detailed subsystem observability & connection status |
| `/api/auth/register` | POST | Register new tenant user and organization |
| `/api/auth/login` | POST | Authenticate and obtain JWT access token |
| `/api/auth/me` | GET | Retrieve authenticated user profile |
| `/api/dashboard` | GET | Overview statistics, recent incidents, effectiveness metrics |
| `/api/integrations` | GET | List connected DevOps providers (GitHub & GitLab) |
| `/api/integrations/{provider}/auth-url` | GET | Generate OAuth authorization URL |
| `/api/integrations/{provider}/oauth-callback`| POST | Exchange OAuth code for provider token |
| `/api/integrations/{provider}/disconnect` | POST | Disconnect provider |
| `/api/integrations/{provider}/sync` | POST | Synchronize repositories from provider |
| `/api/repositories` | GET | List monitored repositories |
| `/api/repositories/discover` | GET | Query accessible repositories from connected provider |
| `/api/repositories/onboard` | POST | Onboard repository with monitored branch and environment |
| `/api/webhooks/github` | POST | Ingest GitHub webhook with HMAC-SHA256 verification |
| `/api/webhooks/gitlab` | POST | Ingest GitLab webhook with `X-Gitlab-Token` verification |
| `/api/deployments` | GET | List recent CI/CD deployments and risk levels |
| `/api/deployments/simulate` | POST | Trigger simulated release and incident workflow |
| `/api/incidents` | GET | List recorded incidents and statuses |
| `/api/incidents/{id}` | GET | Get incident details, evidence, and Hindsight recall |
| `/api/incidents/{id}/investigate` | POST | Execute LangGraph SRE investigation agent |
| `/api/incidents/{id}/correction` | POST | Submit engineer correction & retain into Hindsight |
| `/api/incidents/{id}/resolution` | POST | Record applied remediation & outcome |
| `/api/memory` | GET | Query Hindsight organizational memory bank |
| `/api/memory/reflect` | GET | High-level reflection over organizational knowledge |
| `/api/failure-patterns` | GET | List mined failure patterns |
| `/api/audit` | GET | List immutable audit log entries |

---

## GitHub Setup Instructions

1. Create a GitHub OAuth App or GitHub App in **GitHub Settings -> Developer settings**.
2. Set Authorization callback URL to: `http://localhost:5173/integrations/callback`.
3. Set Webhook URL to: `http://your-domain.com/api/webhooks/github`.
4. Configure `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_WEBHOOK_SECRET` in `.env`.
5. In OpsMemory: Navigate to **Integrations -> Authorize GitHub -> Select Repository -> Enable Monitoring**.

---

## GitLab Setup Instructions

1. Create a GitLab Application in **GitLab -> User Settings -> Applications** or Group Applications.
2. Set Redirect URI to: `http://localhost:5173/integrations/callback` with scopes `api`, `read_user`, `read_repository`.
3. Add Webhook in your GitLab project pointing to: `http://your-domain.com/api/webhooks/gitlab` with Secret Token.
4. Configure `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`, and `GITLAB_WEBHOOK_SECRET` in `.env`.
5. In OpsMemory: Navigate to **Integrations -> Authorize GitLab -> Select Project -> Enable Monitoring**.

---

## Local Development Instructions

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Docker Production Deployment

To start the full production stack (PostgreSQL, Redis, Backend, Worker, Frontend):

```bash
docker-compose up --build -d
```

Check service status:
```bash
docker-compose ps
docker-compose logs -f backend
```

---

## Production Deployment Checklist

- [x] Configure strong, random `JWT_SECRET` (at least 32 characters).
- [x] Configure `ENCRYPTION_KEY` for stored OAuth token security.
- [x] Ensure PostgreSQL database volume is backed up.
- [x] Set `DEMO_MODE=false` in production `.env`.
- [x] Set up HTTPS / TLS reverse proxy (e.g., Cloudflare, AWS ALB, Nginx).
- [x] Configure GitHub & GitLab Webhook HMAC secrets.
- [x] Verify Hindsight API connectivity with production `HINDSIGHT_API_KEY`.
- [x] Verify Groq API key with production `GROQ_API_KEY`.

---

## 3-Minute Live Demo Script

1. **Step 1: Inspect Integrations & Pipeline Observers (30s)**
   - Click **Integrations** in the top navigation bar.
   - Show the active **GitHub** and **GitLab** cards with HMAC-SHA256 signature verification and monitored repositories.
   - Click **Add Repository** to demonstrate repository and branch onboarding.

2. **Step 2: Investigate Incident & Teach OpsMemory (60s)**
   - Navigate to **Incidents** and open **INC-101** (`payment-api` - 504 Gateway Timeouts).
   - Click **Investigate with OpsMemory**. Watch the 10-stage LangGraph execution.
   - Show how the AI initially identifies surface-level Redis timeouts (`RedisConnectionTimeout`).
   - Click **Correct AI Diagnosis**. Enter: *"Redis is only a symptom. The actual root cause is PostgreSQL connection pool exhaustion."*
   - Click **Save Correction & Retain to Hindsight**. Point out the green badge indicating that Hindsight organizational memory has been updated.

3. **Step 3: Verify Learned SRE on Future Deployments (60s)**
   - Click **Simulate Release** or trigger a new pipeline run for `payment-api`.
   - Open the newly generated incident.
   - Click **Investigate with OpsMemory**.
   - Notice the breakthrough: OpsMemory recalls the prior human correction from Hindsight, diagnoses **PostgreSQL connection pool exhaustion**, and recommends scaling pool size from 20 to 100 with 100% historical confidence!
   - Click **Memory Explorer** to show the persistent organizational knowledge ledger.
