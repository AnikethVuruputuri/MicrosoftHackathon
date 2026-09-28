import json
from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select
from app.database.session import engine
from app.models.schemas import (
    Organization,
    User,
    Integration,
    Repository,
    Pipeline,
    PipelineRun,
    PipelineJob,
    Service,
    Deployment,
    DeploymentChange,
    Incident,
    IncidentEvent,
    AgentDiagnosis,
    HumanCorrection,
    RemediationAction,
    ResolutionOutcome,
    FailurePattern,
    MemoryReference,
    AuditLog
)
from app.hindsight.client import hindsight_service
from app.services.security import hash_password, encrypt_secret

def seed_database():
    with Session(engine) as session:
        # Check if already seeded
        existing_org = session.exec(select(Organization)).first()
        if existing_org:
            return

        now = datetime.now(timezone.utc)

        # 1. Organization & User
        org = Organization(
            name="Acme Corporation",
            slug="acme-corp",
            hindsight_bank_id="opsmemory-demo"
        )
        session.add(org)
        session.commit()
        session.refresh(org)

        admin_user = User(
            org_id=org.id,
            name="Alex Rivera",
            email="alex.dev@acme.corp",
            hashed_password=hash_password("opsmemory2026"),
            role="admin"
        )
        session.add(admin_user)

        # 2. Integrations (GitHub & GitLab) - Clean initial state: DISCONNECTED
        gh_integration = Integration(
            org_id=org.id,
            provider="github",
            status="disconnected",
            auth_type="token",
            account_name="Not connected",
            account_id="",
            encrypted_token=None,
            webhook_secret="opsmemory-github-webhook-secret",
            last_sync_at=None
        )
        gl_integration = Integration(
            org_id=org.id,
            provider="gitlab",
            status="disconnected",
            auth_type="token",
            account_name="Not connected",
            account_id="",
            encrypted_token=None,
            webhook_secret="opsmemory-gitlab-webhook-secret",
            last_sync_at=None
        )
        session.add_all([gh_integration, gl_integration])
        session.commit()
        session.refresh(gh_integration)
        session.refresh(gl_integration)

        # 3. Repositories - Clean state (populated when user onboards from connected accounts in UI)

        # 4. Services
        services_data = [
            Service(org_id=org.id, name="payment-api", description="Core payment processing and checkout gateway", repository="acme/payment-api", owner_team="Fintech SRE", tier="tier-1", status="incident"),
            Service(org_id=org.id, name="user-service", description="User authentication, profile management and session control", repository="acme/user-service", owner_team="Identity Team", tier="tier-1", status="operational"),
            Service(org_id=org.id, name="order-service", description="Order lifecycle, cart management and fulfillment sync", repository="acme/order-service", owner_team="Commerce SRE", tier="tier-1", status="operational"),
            Service(org_id=org.id, name="notification-service", description="Push notifications, SMS dispatch and email delivery", repository="acme/notification-service", owner_team="Growth Eng", tier="tier-2", status="operational"),
            Service(org_id=org.id, name="inventory-service", description="Real-time stock reservation and warehouse tracking", repository="fintech/inventory-service", owner_team="Logistics SRE", tier="tier-2", status="operational"),
        ]
        session.add_all(services_data)
        session.commit()

        services = {s.name: s for s in session.exec(select(Service)).all()}

        # 5. Remediation Actions
        remediations = [
            RemediationAction(action_name="Increase DB pool size", category="config", description="Scale up pool_size and max_overflow in database configuration"),
            RemediationAction(action_name="Rollback deployment", category="rollback", description="Revert service deployment to previous stable SHA"),
            RemediationAction(action_name="Restart service", category="infra", description="Perform rolling restart of worker pods"),
            RemediationAction(action_name="Inject missing env var", category="config", description="Add missing secret or config map key"),
            RemediationAction(action_name="Flush Redis cache", category="infra", description="Clear stale cache keys and reinitialize client connections"),
        ]
        session.add_all(remediations)

        # 6. Failure Patterns
        patterns = [
            FailurePattern(
                org_id=org.id,
                pattern_name="Database Connection Pool Exhaustion",
                category="Infrastructure / Database",
                common_trigger="Database configuration change reducing pool size under high concurrency",
                common_symptom="Redis timeouts followed by PoolAcquireTimeoutError and 504 Gateway Timeouts",
                common_root_cause="PostgreSQL connection pool exhaustion",
                recommended_remediation="Increase DB pool size from 20 to 100",
                occurrence_count=7,
                services_affected="payment-api, order-service",
                last_seen_at=now - timedelta(minutes=15)
            ),
            FailurePattern(
                org_id=org.id,
                pattern_name="Missing Auth Secret In Deployment",
                category="Configuration / Secrets",
                common_trigger="Deployment manifest refactoring omitting secretRef mapping",
                common_symptom="KeyError: 'JWT_SECRET' during service bootstrap",
                common_root_cause="Missing environment variable in production vault",
                recommended_remediation="Inject missing env var",
                occurrence_count=3,
                services_affected="user-service",
                last_seen_at=now - timedelta(days=2)
            ),
            FailurePattern(
                org_id=org.id,
                pattern_name="Dependency Version Conflict",
                category="Dependencies",
                common_trigger="Transitive library upgrade without pinning sub-dependencies",
                common_symptom="ImportError: cannot import name 'AsyncClient' from httpx",
                common_root_cause="Incompatible dependency wheel installed during Docker build",
                recommended_remediation="Rollback deployment",
                occurrence_count=4,
                services_affected="notification-service, inventory-service",
                last_seen_at=now - timedelta(days=5)
            ),
            FailurePattern(
                org_id=org.id,
                pattern_name="Redis Socket Pool Depletion",
                category="Cache",
                common_trigger="Redis connection timeout setting reduced below 100ms",
                common_symptom="RedisConnectionTimeout on session cache acquire",
                common_root_cause="Insufficient Redis client connection pool under burst traffic",
                recommended_remediation="Increase Redis client pool and socket timeout",
                occurrence_count=2,
                services_affected="payment-api, user-service",
                last_seen_at=now - timedelta(days=12)
            )
        ]
        session.add_all(patterns)

        # 7. Historical Resolution Outcomes (6-0 for pool increase, 8-1 for rollback, 2-5 for restart)
        outcomes = [
            ResolutionOutcome(org_id=org.id, incident_code="INC-088", service_name="payment-api", failure_fingerprint="PAYMENT_API_DB_POOL_PRODUCTION", remediation_action="Increase DB pool size", success=True, recovery_time_minutes=2),
            ResolutionOutcome(org_id=org.id, incident_code="INC-074", service_name="order-service", failure_fingerprint="ORDER_SERVICE_DB_POOL_PRODUCTION", remediation_action="Increase DB pool size", success=True, recovery_time_minutes=3),
            ResolutionOutcome(org_id=org.id, incident_code="INC-062", service_name="payment-api", failure_fingerprint="PAYMENT_API_DB_POOL_PRODUCTION", remediation_action="Increase DB pool size", success=True, recovery_time_minutes=2),
            ResolutionOutcome(org_id=org.id, incident_code="INC-055", service_name="order-service", failure_fingerprint="ORDER_SERVICE_DB_POOL_PRODUCTION", remediation_action="Increase DB pool size", success=True, recovery_time_minutes=4),
            ResolutionOutcome(org_id=org.id, incident_code="INC-041", service_name="payment-api", failure_fingerprint="PAYMENT_API_DB_POOL_PRODUCTION", remediation_action="Increase DB pool size", success=True, recovery_time_minutes=2),
            ResolutionOutcome(org_id=org.id, incident_code="INC-029", service_name="payment-api", failure_fingerprint="PAYMENT_API_DB_POOL_PRODUCTION", remediation_action="Increase DB pool size", success=True, recovery_time_minutes=3),
            
            ResolutionOutcome(org_id=org.id, incident_code="INC-092", service_name="notification-service", failure_fingerprint="NOTIFICATION_SERVICE_DEPENDENCY_PRODUCTION", remediation_action="Rollback deployment", success=True, recovery_time_minutes=5, rollback_required=True),
            ResolutionOutcome(org_id=org.id, incident_code="INC-085", service_name="user-service", failure_fingerprint="USER_SERVICE_AUTH_MODULE_PRODUCTION", remediation_action="Rollback deployment", success=True, recovery_time_minutes=4, rollback_required=True),
            ResolutionOutcome(org_id=org.id, incident_code="INC-078", service_name="inventory-service", failure_fingerprint="INVENTORY_SERVICE_CORE_PRODUCTION", remediation_action="Rollback deployment", success=True, recovery_time_minutes=6, rollback_required=True),
            ResolutionOutcome(org_id=org.id, incident_code="INC-069", service_name="order-service", failure_fingerprint="ORDER_SERVICE_CORE_PRODUCTION", remediation_action="Rollback deployment", success=True, recovery_time_minutes=4, rollback_required=True),
            ResolutionOutcome(org_id=org.id, incident_code="INC-051", service_name="payment-api", failure_fingerprint="PAYMENT_API_CORE_PRODUCTION", remediation_action="Rollback deployment", success=True, recovery_time_minutes=5, rollback_required=True),
            ResolutionOutcome(org_id=org.id, incident_code="INC-043", service_name="user-service", failure_fingerprint="USER_SERVICE_AUTH_MODULE_PRODUCTION", remediation_action="Rollback deployment", success=True, recovery_time_minutes=4, rollback_required=True),
            ResolutionOutcome(org_id=org.id, incident_code="INC-033", service_name="notification-service", failure_fingerprint="NOTIFICATION_SERVICE_CORE_PRODUCTION", remediation_action="Rollback deployment", success=True, recovery_time_minutes=6, rollback_required=True),
            ResolutionOutcome(org_id=org.id, incident_code="INC-021", service_name="inventory-service", failure_fingerprint="INVENTORY_SERVICE_CORE_PRODUCTION", remediation_action="Rollback deployment", success=True, recovery_time_minutes=5, rollback_required=True),
            ResolutionOutcome(org_id=org.id, incident_code="INC-015", service_name="payment-api", failure_fingerprint="PAYMENT_API_DB_POOL_PRODUCTION", remediation_action="Rollback deployment", success=False, recovery_time_minutes=15, rollback_required=True, notes="Rollback failed due to unmigrated DB schema"),

            ResolutionOutcome(org_id=org.id, incident_code="INC-080", service_name="payment-api", failure_fingerprint="PAYMENT_API_DB_POOL_PRODUCTION", remediation_action="Restart service", success=False, recovery_time_minutes=12, notes="Restart caused instant reconnection flood; pool exhausted immediately again"),
            ResolutionOutcome(org_id=org.id, incident_code="INC-071", service_name="order-service", failure_fingerprint="ORDER_SERVICE_DB_POOL_PRODUCTION", remediation_action="Restart service", success=False, recovery_time_minutes=10, notes="Did not fix pool exhaustion"),
            ResolutionOutcome(org_id=org.id, incident_code="INC-060", service_name="payment-api", failure_fingerprint="PAYMENT_API_DB_POOL_PRODUCTION", remediation_action="Restart service", success=False, recovery_time_minutes=14, notes="Pool exhaustion recurred within 30s"),
            ResolutionOutcome(org_id=org.id, incident_code="INC-047", service_name="notification-service", failure_fingerprint="NOTIFICATION_SERVICE_CORE_PRODUCTION", remediation_action="Restart service", success=True, recovery_time_minutes=3),
            ResolutionOutcome(org_id=org.id, incident_code="INC-037", service_name="user-service", failure_fingerprint="USER_SERVICE_CACHE_LAYER_PRODUCTION", remediation_action="Restart service", success=True, recovery_time_minutes=4),
            ResolutionOutcome(org_id=org.id, incident_code="INC-025", service_name="order-service", failure_fingerprint="ORDER_SERVICE_DB_POOL_PRODUCTION", remediation_action="Restart service", success=False, recovery_time_minutes=11),
            ResolutionOutcome(org_id=org.id, incident_code="INC-018", service_name="payment-api", failure_fingerprint="PAYMENT_API_DB_POOL_PRODUCTION", remediation_action="Restart service", success=False, recovery_time_minutes=15),
        ]
        session.add_all(outcomes)

        # 8. Primary Demo Deployment #101 & Incident INC-101
        dep_101 = Deployment(
            org_id=org.id,
            deployment_number=101,
            service_id=services["payment-api"].id,
            service_name="payment-api",
            environment="production",
            commit_sha="a7b8c9d",
            commit_message="perf(db): optimize connection pool parameters for high throughput",
            author="alex.dev",
            status="failed",
            risk_level="high",
            risk_reason="Historical database pool configuration changes have triggered multiple incidents",
            started_at=now - timedelta(minutes=25),
            completed_at=now - timedelta(minutes=20),
            logs_summary="Redis connection errors followed by PoolAcquireTimeoutError (pool size 20 reached)",
            raw_logs="""[2026-09-28T05:14:02Z] INFO  [payment-api.bootstrap] Initializing payment service worker on port 8080
[2026-09-28T05:14:05Z] INFO  [payment-api.db] Connecting to PostgreSQL cluster at db-primary.internal.net:5432 (pool_size=20)
[2026-09-28T05:14:08Z] INFO  [payment-api.cache] Connecting to Redis cache at redis.internal.net:6379
[2026-09-28T05:14:15Z] WARN  [payment-api.traffic] Incoming burst traffic: 1,420 req/sec across 24 checkout worker threads
[2026-09-28T05:14:22Z] ERROR [payment-api.cache] RedisConnectionTimeout: Connection to redis.internal.net:6379 timed out after 500ms
[2026-09-28T05:14:23Z] ERROR [payment-api.http] 504 Gateway Timeout on POST /v1/charges/authorize - unable to acquire cache session lock
[2026-09-28T05:14:25Z] ERROR [payment-api.db] PoolAcquireTimeoutError: Queue pool limit of size 20 reached, max overflow reached, connection cannot be checked out within 5.00 seconds.
[2026-09-28T05:14:28Z] CRITICAL [payment-api.health] Readiness probe failed 3 consecutive times: HTTP 503 Service Unavailable
[2026-09-28T05:14:30Z] FATAL [k8s-controller] Pod payment-api-7b8f9c4d-9k2j8 marked UNHEALTHY. Traffic routing suspended."""
        )
        session.add(dep_101)
        session.flush()

        ch_101 = DeploymentChange(
            deployment_id=dep_101.id,
            change_type="config",
            component="database_pool",
            file_path="config/database.yml",
            diff_snippet="- pool_size: 100\n+ pool_size: 20\n- timeout: 5000\n+ timeout: 500",
            description="Reduced pool size to 20 connections and reduced acquire timeout to 500ms."
        )
        session.add(ch_101)

        # Other deployments
        svc_names = ["user-service", "order-service", "notification-service", "inventory-service", "payment-api"]
        authors = ["sarah.sre", "michael.dev", "elena.tech", "david.ops", "alex.dev"]
        statuses = ["success", "success", "success", "failed", "success", "success", "rolled_back", "success"]

        for i in range(102, 121):
            s_name = svc_names[i % len(svc_names)]
            st = statuses[i % len(statuses)]
            risk = "high" if "db" in s_name or i % 4 == 0 else "low"
            dep = Deployment(
                org_id=org.id,
                deployment_number=i,
                service_id=services[s_name].id,
                service_name=s_name,
                environment="production" if i % 3 != 0 else "staging",
                commit_sha=f"c{i}fa{i*3}",
                commit_message=f"feat({s_name.split('-')[0]}): update business logic and optimize handlers (patch #{i})",
                author=authors[i % len(authors)],
                status=st,
                risk_level=risk,
                risk_reason="Normal release" if risk == "low" else "Historical component sensitivity",
                started_at=now - timedelta(hours=i - 100),
                completed_at=now - timedelta(hours=i - 100) + timedelta(minutes=6),
                logs_summary="Deployment completed successfully with health checks passing" if st == "success" else "Rollout failed on health probe",
                raw_logs=f"Deployment #{i} for {s_name} completed with status: {st}"
            )
            session.add(dep)
            session.flush()

            session.add(DeploymentChange(
                deployment_id=dep.id,
                change_type="code" if i % 2 == 0 else "config",
                component="core",
                file_path=f"src/{s_name}/handler.py",
                diff_snippet="+ // release patch update",
                description=f"Routine update for deployment #{i}"
            ))

        # Primary Incident INC-101
        inc_101 = Incident(
            org_id=org.id,
            incident_code="INC-101",
            title="Payment API 504 Gateway Timeouts and Cache Failures",
            service_id=services["payment-api"].id,
            service_name="payment-api",
            deployment_id=dep_101.id,
            environment="production",
            severity="critical",
            status="investigating",
            failure_fingerprint="PAYMENT_API_DB_POOL_PRODUCTION",
            symptoms_summary="Redis connection timeout errors reported during checkout surges, 504 Gateway Timeouts, readiness probe failing.",
            detected_at=now - timedelta(minutes=20)
        )
        session.add(inc_101)
        session.flush()

        session.add(IncidentEvent(
            incident_id=inc_101.id,
            timestamp=now - timedelta(minutes=20),
            event_type="alert",
            stage_name="alert",
            summary="PagerDuty Alert: payment-api error rate > 5% in production."
        ))

        # Historical incidents
        hist_incidents_data = [
            ("INC-095", "user-service", "USER_SERVICE_AUTH_MODULE_PRODUCTION", "Auth middleware panic on missing JWT_SECRET", "Missing environment variable in vault mapping", "Inject missing env var", "success"),
            ("INC-088", "payment-api", "PAYMENT_API_DB_POOL_PRODUCTION", "Payment checkout 500 errors after pool reduction", "PostgreSQL connection pool exhaustion", "Increase DB pool size", "success"),
            ("INC-082", "order-service", "ORDER_SERVICE_DB_POOL_PRODUCTION", "Order placement queue timeout during flash sale", "DB connection pool exhaustion on order table", "Increase DB pool size", "success"),
            ("INC-076", "notification-service", "NOTIFICATION_SERVICE_DEPENDENCY_PRODUCTION", "Worker crash loop after httpx upgrade", "Incompatible async HTTP client sub-dependency", "Rollback deployment", "success"),
            ("INC-068", "inventory-service", "INVENTORY_SERVICE_CORE_PRODUCTION", "Stock sync deadlocks under concurrency", "Row lock contention in warehouse transaction", "Rollback deployment", "success"),
            ("INC-059", "payment-api", "PAYMENT_API_DB_POOL_PRODUCTION", "Payment latency spike and connection drops", "PostgreSQL pool limit reached", "Increase DB pool size", "success"),
            ("INC-044", "user-service", "USER_SERVICE_CACHE_LAYER_PRODUCTION", "Session invalidation storm on user login", "Redis cluster connection pool saturated", "Restart service", "success"),
            ("INC-035", "order-service", "ORDER_SERVICE_CORE_PRODUCTION", "Cart total calculation precision discrepancy", "Decimal rounding regression in billing helper", "Rollback deployment", "success"),
            ("INC-022", "payment-api", "PAYMENT_API_DB_POOL_PRODUCTION", "Checkout failure during Black Friday load test", "Database connection pool undersized", "Increase DB pool size", "success"),
        ]

        for code, sname, fp, sym, root, fix, st in hist_incidents_data:
            inc = Incident(
                org_id=org.id,
                incident_code=code,
                title=f"{sname}: {sym[:50]}",
                service_id=services[sname].id,
                service_name=sname,
                environment="production",
                severity="high",
                status="resolved",
                failure_fingerprint=fp,
                symptoms_summary=sym,
                detected_at=now - timedelta(days=int(code.split('-')[1]) % 20 + 2),
                resolved_at=now - timedelta(days=int(code.split('-')[1]) % 20 + 2) + timedelta(minutes=15),
                initial_diagnosis=f"Initial hypothesis suspected infrastructure failure: {sym}",
                human_correction=f"Engineer confirmed: {root}",
                confirmed_root_cause=root,
                remediation_applied=fix,
                resolution_status=st,
                recovery_time_seconds=180,
                retained_in_hindsight=True
            )
            session.add(inc)
            session.flush()

            if fp == "PAYMENT_API_DB_POOL_PRODUCTION":
                session.add(HumanCorrection(
                    org_id=org.id,
                    incident_id=inc.id,
                    engineer_name="SRE Tech Lead",
                    incorrect_hypothesis="Redis connection timeout / Cache outage",
                    correction_text="Redis is only a symptom. The actual root cause is PostgreSQL connection pool exhaustion.",
                    actual_root_cause="PostgreSQL connection pool exhaustion",
                    remediation_guidance="Increase DB pool size in database.yml",
                    failure_fingerprint=fp,
                    retained_to_hindsight=True
                ))

        # 9. Audit Logs
        session.add_all([
            AuditLog(org_id=org.id, actor="alex.dev", action="integration_connected", resource_type="integration", resource_id="github", details="Connected GitHub organization acme-engineering"),
            AuditLog(org_id=org.id, actor="alex.dev", action="integration_connected", resource_type="integration", resource_id="gitlab", details="Connected GitLab group fintech-group"),
            AuditLog(org_id=org.id, actor="alex.dev", action="repository_monitored", resource_type="repository", resource_id="payment-api", details="Enabled real-time pipeline monitoring and Hindsight memory learning"),
            AuditLog(org_id=org.id, actor="system", action="incident_created", resource_type="incident", resource_id="INC-101", details="Incident INC-101 opened for payment-api"),
        ])

        session.commit()

        # Seed initial knowledge into Hindsight service
        hindsight_service.retain(
            contents="Historical Engineering Knowledge for payment-api [PAYMENT_API_DB_POOL_PRODUCTION]: Redis connection timeouts on checkout are typically downstream symptoms of PostgreSQL connection pool exhaustion. Increasing DB pool size from 20 to 100 resolved all past occurrences.",
            memory_type="engineering_knowledge",
            tags=["payment-api", "payment_api_db_pool_production", "database_pool", "postgresql"],
            metadata={
                "incident_code": "INC-088",
                "service": "payment-api",
                "failure_fingerprint": "PAYMENT_API_DB_POOL_PRODUCTION",
                "actual_root_cause": "PostgreSQL connection pool exhaustion",
                "remediation": "Increase DB pool size"
            },
            org_id=org.id
        )

        hindsight_service.retain(
            contents="Historical Incident INC-095 for user-service [USER_SERVICE_AUTH_MODULE_PRODUCTION]: Deployment failed due to missing JWT_SECRET in production environment vault. Resolved by injecting missing env var.",
            memory_type="incident",
            tags=["user-service", "user_service_auth_module_production", "auth_middleware"],
            metadata={
                "incident_code": "INC-095",
                "service": "user-service",
                "failure_fingerprint": "USER_SERVICE_AUTH_MODULE_PRODUCTION",
                "actual_root_cause": "Missing JWT_SECRET environment variable",
                "remediation": "Inject missing env var"
            },
            org_id=org.id
        )
