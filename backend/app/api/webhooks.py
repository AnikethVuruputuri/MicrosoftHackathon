import hashlib
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Depends, Header
from sqlmodel import Session, select
from app.config import settings
from app.database.session import get_session
from app.models.schemas import WebhookEvent, Integration
from app.services.providers import github_provider, gitlab_provider
from app.services.queue import task_queue

logger = logging.getLogger("opsmemory.webhooks")
router = APIRouter(prefix="/webhooks", tags=["Webhooks Ingestion"])

@router.post("/github")
async def github_webhook(request: Request, session: Session = Depends(get_session)):
    raw_body = await request.body()
    headers = dict(request.headers)

    # 1. Signature Verification
    intg = session.exec(select(Integration).where(Integration.provider == "github")).first()
    secret = intg.webhook_secret if intg and intg.webhook_secret else settings.GITHUB_WEBHOOK_SECRET

    if not github_provider.verify_webhook_signature(headers, raw_body, secret):
        logger.warning("GitHub webhook signature verification failed.")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # 2. Parse JSON Payload
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed JSON payload")

    # 3. Normalized Payload & Delivery ID
    norm_event = github_provider.normalize_webhook(headers, payload)
    delivery_id = headers.get("X-GitHub-Delivery") or headers.get("x-github-delivery") or f"gh-del-{datetime.now(timezone.utc).timestamp()}"
    payload_hash = hashlib.sha256(raw_body).hexdigest()

    # 4. Idempotency Check
    existing_event = session.exec(
        select(WebhookEvent).where(WebhookEvent.delivery_id == delivery_id)
    ).first()

    if existing_event:
        logger.info(f"Duplicate GitHub webhook delivery ignored: {delivery_id}")
        return {"status": "ignored", "reason": "duplicate_event", "delivery_id": delivery_id}

    # 5. Record Webhook Event in PostgreSQL
    wb_event = WebhookEvent(
        org_id=1,
        provider="github",
        event_type=headers.get("X-GitHub-Event", "workflow_run"),
        delivery_id=delivery_id,
        payload_hash=payload_hash,
        status="received"
    )
    session.add(wb_event)
    session.commit()
    session.refresh(wb_event)

    # 6. Enqueue Background Task for Async Pipeline & SRE Investigation
    if norm_event:
        task_queue.enqueue(
            "process_webhook",
            {
                "webhook_event_id": wb_event.id,
                "normalized_payload": norm_event.model_dump()
            }
        )

    return {
        "status": "accepted",
        "delivery_id": delivery_id,
        "event_type": wb_event.event_type,
        "pipeline_status": norm_event.pipeline_status if norm_event else "untracked"
    }

@router.post("/gitlab")
async def gitlab_webhook(request: Request, session: Session = Depends(get_session)):
    raw_body = await request.body()
    headers = dict(request.headers)

    # 1. Secret Token Verification
    intg = session.exec(select(Integration).where(Integration.provider == "gitlab")).first()
    secret = intg.webhook_secret if intg and intg.webhook_secret else settings.GITLAB_WEBHOOK_SECRET

    if not gitlab_provider.verify_webhook_signature(headers, raw_body, secret):
        logger.warning("GitLab webhook token verification failed.")
        raise HTTPException(status_code=401, detail="Invalid webhook token")

    # 2. Parse JSON Payload
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed JSON payload")

    # 3. Normalize Event
    norm_event = gitlab_provider.normalize_webhook(headers, payload)
    delivery_id = norm_event.delivery_id if norm_event else f"gl-del-{datetime.now(timezone.utc).timestamp()}"
    payload_hash = hashlib.sha256(raw_body).hexdigest()

    # 4. Idempotency Check
    existing_event = session.exec(
        select(WebhookEvent).where(WebhookEvent.delivery_id == delivery_id)
    ).first()

    if existing_event:
        logger.info(f"Duplicate GitLab webhook delivery ignored: {delivery_id}")
        return {"status": "ignored", "reason": "duplicate_event", "delivery_id": delivery_id}

    # 5. Record Event
    wb_event = WebhookEvent(
        org_id=1,
        provider="gitlab",
        event_type=headers.get("X-Gitlab-Event", "pipeline"),
        delivery_id=delivery_id,
        payload_hash=payload_hash,
        status="received"
    )
    session.add(wb_event)
    session.commit()
    session.refresh(wb_event)

    # 6. Enqueue Background Task
    if norm_event:
        task_queue.enqueue(
            "process_webhook",
            {
                "webhook_event_id": wb_event.id,
                "normalized_payload": norm_event.model_dump()
            }
        )

    return {
        "status": "accepted",
        "delivery_id": delivery_id,
        "event_type": wb_event.event_type,
        "pipeline_status": norm_event.pipeline_status if norm_event else "untracked"
    }

@router.post("/azure-monitor")
async def azure_monitor_webhook(request: Request, session: Session = Depends(get_session)):
    """
    Ingests Cloud Monitor and APM alerts (Common Alert Schema).
    Automatically maps cloud telemetry metrics to services and initiates autonomous diagnosis.
    """
    from app.models.schemas import Incident
    from sqlmodel import func

    raw_body = await request.body()
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed JSON payload")

    data = payload.get("data", {})
    essentials = data.get("essentials", {})
    alert_rule = essentials.get("alertRule") or payload.get("alertRule") or "Azure Monitor Alert"
    target_resource = essentials.get("targetResourceName") or essentials.get("targetResourceGroup") or payload.get("resourceName") or "payment-api"
    
    severity_map = {
        "Sev0": "critical",
        "Sev1": "high",
        "Sev2": "medium",
        "Sev3": "low",
        "Sev4": "low"
    }
    sev_raw = essentials.get("severity", "Sev1")
    severity = severity_map.get(sev_raw, "high")
    description = essentials.get("description") or f"Azure Monitor [{alert_rule}] fired on {target_resource}."
    
    delivery_id = essentials.get("alertId") or f"az-alert-{datetime.now(timezone.utc).timestamp()}"
    payload_hash = hashlib.sha256(raw_body).hexdigest()

    deliv_str = str(delivery_id)[:250]
    existing_event = session.exec(
        select(WebhookEvent).where(WebhookEvent.delivery_id == deliv_str)
    ).first()
    if existing_event:
        return {"status": "ignored", "reason": "duplicate_event", "delivery_id": deliv_str}

    # Record Webhook Event
    wb_event = WebhookEvent(
        org_id=1,
        provider="azure",
        event_type="azure_monitor_alert",
        delivery_id=deliv_str,
        payload_hash=payload_hash,
        status="received"
    )
    session.add(wb_event)
    session.commit()
    session.refresh(wb_event)


    # Automatically create Incident
    from app.models.schemas import Service
    svc_name = target_resource.split("/")[-1]
    svc = session.exec(select(Service).where(Service.name == svc_name)).first()
    service_id = svc.id if svc else 1

    count = session.exec(select(func.count(Incident.id))).one()
    inc_code = f"INC-AZ-{count + 1:04d}"
    incident = Incident(
        org_id=1,
        incident_code=inc_code,
        title=f"Cloud Alert: {alert_rule}",
        service_id=service_id,
        service_name=svc_name,
        environment="production",
        severity=severity,
        status="investigating",
        symptoms_summary=f"Cloud Monitor [{alert_rule}]: {description}",
        detected_at=datetime.now(timezone.utc)
    )
    session.add(incident)
    session.commit()
    session.refresh(incident)


    # Enqueue investigation
    task_queue.enqueue("investigate_incident", {"incident_id": incident.id})

    return {
        "status": "accepted",
        "incident_id": incident.id,
        "incident_code": incident.incident_code,
        "alert_rule": alert_rule,
        "severity": severity,
        "target_resource": target_resource,
        "monitoring_service": essentials.get("monitoringService", "Cloud Monitor / APM Telemetry")
    }
