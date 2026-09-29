import json
import pytest
import httpx

from app.services.automation import (
    AutomationContext,
    CiRetryExecutor,
    evaluate_automation_policy,
    execute_automation,
    select_automatic_action,
)


def make_context(**overrides):
    values = {
        "incident_id": 1,
        "service_name": "checkout",
        "environment": "staging",
        "action": "retry",
        "failure_fingerprint": "CHECKOUT_TIMEOUT_STAGING",
        "confidence": 0.95,
        "severity": "low",
        "known_successful_pattern": True,
        "health_check_count": 1,
        "health_check_interval_seconds": 0,
    }
    values.update(overrides)
    return AutomationContext(**values)


def test_policy_fails_closed_for_unknown_pattern_and_disabled_automation():
    unknown = evaluate_automation_policy(
        make_context(known_successful_pattern=False), automation_enabled=True
    )
    disabled = evaluate_automation_policy(make_context(), automation_enabled=False)

    assert not unknown["allowed"]
    assert not disabled["allowed"]


def test_automatic_action_requires_an_explicit_retry_recommendation():
    assert select_automatic_action("Retry the failed health-check job once") == "retry"
    assert select_automatic_action("Do not retry this deployment") == "no_action"
    assert select_automatic_action("Avoid rerun because the migration is unsafe") == "no_action"
    assert select_automatic_action("Increase the database pool size") == "no_action"


def test_production_rollback_requires_human_approval():
    context = make_context(action="rollback", environment="production", allow_rollback=True)

    pending = evaluate_automation_policy(context, automation_enabled=True)
    approved = evaluate_automation_policy(
        context, automation_enabled=True, approved_by_human=True
    )

    assert not pending["allowed"]
    assert pending["requires_approval"]
    assert approved["allowed"]


def test_low_medium_retry_can_run_in_production_without_approval():
    production = evaluate_automation_policy(
        make_context(environment="production"), automation_enabled=True
    )

    assert production["allowed"]
    assert not production["requires_approval"]


def test_retry_is_rejected_for_high_severity_or_after_one_attempt():
    high_severity = evaluate_automation_policy(
        make_context(severity="high"), automation_enabled=True
    )
    repeated = evaluate_automation_policy(
        make_context(previous_attempts=1), automation_enabled=True
    )
    allowed_second_attempt = evaluate_automation_policy(
        make_context(previous_attempts=1, max_attempts=2), automation_enabled=True
    )

    assert not high_severity["allowed"]
    assert not repeated["allowed"]
    assert allowed_second_attempt["allowed"]


def test_failed_health_check_compensates_and_escalates():
    class Executor:
        compensated = False

        def execute(self, context):
            return {"operation_id": "op-1"}

        def health_check(self, context, execution_data=None):
            return False

        def compensate(self, context, execution_data):
            self.compensated = execution_data == {"operation_id": "op-1"}
            return self.compensated

    executor = Executor()
    result = execute_automation(
        make_context(), executor=executor, automation_enabled=True
    )

    assert result["status"] == "escalated"
    assert result["health_check_passed"] is False
    assert result["compensated"] is True


def test_success_requires_health_check():
    class Executor:
        def execute(self, context):
            return None

        def health_check(self, context, execution_data=None):
            return True

        def compensate(self, context, execution_data):
            return False

    result = execute_automation(
        make_context(), executor=Executor(), automation_enabled=True
    )

    assert result["status"] == "succeeded"
    assert result["health_check_passed"] is True


@pytest.mark.parametrize(
    ("provider", "repository", "api_base_url", "pipeline_id", "expected_retry_path", "retry_response"),
    [
        ("github", "acme/checkout", None, "123", "/actions/runs/123/rerun-failed-jobs", b""),
        ("gitlab", "acme/checkout", "https://gitlab.com/api/v4", "123", "/projects/acme%2Fcheckout/pipelines/123/retry", b'{"id":456}'),
    ],
)
def test_ci_retry_executor_retries_exact_run_and_checks_health(
    provider, repository, api_base_url, pipeline_id, expected_retry_path, retry_response
):
    requested = []

    def handler(request):
        requested.append(request)
        if request.method == "GET" and request.url.path.endswith("/jobs"):
            if provider == "github":
                return httpx.Response(200, json={"jobs": [{"name": "unit tests", "status": "completed", "conclusion": "failure"}]})
            return httpx.Response(200, json=[{"name": "unit tests", "stage": "test", "status": "failed"}])
        if request.method == "POST" and (
            request.url.path.endswith("/retry")
            or request.url.path.endswith("/rerun-failed-jobs")
        ):
            return httpx.Response(201, content=retry_response)
        if request.method == "GET" and request.url.host in {"health.example.com", "metrics.example.com"}:
            return httpx.Response(200)
        if request.method == "GET":
            if request.url.host == "gitlab.com":
                return httpx.Response(200, json={"status": "success", "id": 456})
            return httpx.Response(200, json={"status": "completed", "conclusion": "success", "id": 456})
        return httpx.Response(202)

    context = make_context(
        provider=provider,
        repository=repository,
        pipeline_id=pipeline_id,
        api_base_url=api_base_url,
        health_check_url=json.dumps([
            "https://health.example.com/ready",
            "https://metrics.example.com/health",
        ]),
        credential="real-test-token",
        health_check_count=2,
        health_check_interval_seconds=0,
    )
    executor = CiRetryExecutor(
        transport=httpx.MockTransport(handler),
        poll_interval=0,
        max_polls=1,
    )
    result = execute_automation(context, executor=executor, automation_enabled=True)

    assert result["status"] == "succeeded"
    assert any(
        request.method == "POST" and request.url.raw_path.decode().endswith(expected_retry_path)
        for request in requested
    )
    assert any(request.url.host == "health.example.com" for request in requested)
    assert any(request.url.host == "metrics.example.com" for request in requested)


def test_ci_retry_executor_blocks_failed_deployment_job_before_retry():
    requested = []

    def handler(request):
        requested.append(request)
        if request.url.path.endswith("/jobs"):
            return httpx.Response(200, json={"jobs": [{"name": "deploy production", "status": "completed", "conclusion": "failure"}]})
        return httpx.Response(201)

    context = make_context(
        provider="github",
        repository="acme/checkout",
        pipeline_id="123",
        health_check_url="https://health.example.com/ready",
        credential="real-test-token",
    )
    executor = CiRetryExecutor(transport=httpx.MockTransport(handler), max_polls=1)
    result = execute_automation(context, executor=executor, automation_enabled=True)

    assert result["status"] == "escalated"
    assert not any(request.method == "POST" for request in requested)


def test_failed_service_probe_compensates_after_successful_ci_retry():
    def handler(request):
        if request.method == "GET" and request.url.path.endswith("/jobs"):
            return httpx.Response(200, json={"jobs": [{"name": "unit tests", "conclusion": "failure"}]})
        if request.method == "POST" and request.url.path.endswith("/rerun-failed-jobs"):
            return httpx.Response(201)
        if request.method == "GET" and request.url.host == "api.github.com":
            return httpx.Response(200, json={"status": "completed", "conclusion": "success"})
        if request.method == "GET" and request.url.host == "health.example.com":
            return httpx.Response(200)
        if request.method == "GET" and request.url.host == "metrics.example.com":
            return httpx.Response(503)
        if request.method == "POST" and request.url.path.endswith("/cancel"):
            return httpx.Response(202)
        return httpx.Response(404)

    context = make_context(
        provider="github",
        repository="acme/checkout",
        pipeline_id="123",
        health_check_url=json.dumps([
            "https://health.example.com/ready",
            "https://metrics.example.com/health",
        ]),
        credential="real-test-token",
        health_check_count=1,
        health_check_interval_seconds=0,
    )
    executor = CiRetryExecutor(transport=httpx.MockTransport(handler), max_polls=1)
    result = execute_automation(context, executor=executor, automation_enabled=True)

    assert result["status"] == "escalated"
    assert result["health_check_passed"] is False
    assert result["compensated"] is True