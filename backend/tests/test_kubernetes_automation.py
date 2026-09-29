from types import SimpleNamespace

import httpx

from app.services.automation import AutomationContext, execute_automation, evaluate_automation_policy
from app.services.kubernetes_automation import KubernetesAutomationExecutor


def make_context(**overrides):
    values = {
        "incident_id": 11,
        "service_name": "checkout",
        "environment": "production",
        "action": "restart",
        "failure_fingerprint": "CHECKOUT_READY_PRODUCTION",
        "confidence": 0.99,
        "severity": "low",
        "known_successful_pattern": True,
        "provider": "kubernetes",
        "repository": "acme/checkout",
        "health_check_url": "https://checkout.example.com/ready",
        "kube_namespace": "production",
        "kube_deployment": "checkout-api",
        "allow_restart": True,
        "allow_rollback": True,
        "health_check_count": 1,
        "health_check_interval_seconds": 0,
    }
    values.update(overrides)
    return AutomationContext(**values)


class FakeAppsApi:
    def __init__(self, replica_sets=None):
        self.patches = []
        self.replica_sets = replica_sets or []
        self.deployment = SimpleNamespace(
            metadata=SimpleNamespace(
                annotations={"deployment.kubernetes.io/revision": "2"},
                generation=2,
                uid="deployment-uid",
            ),
            spec=SimpleNamespace(
                replicas=2,
                selector=SimpleNamespace(match_labels={"app": "checkout"}),
                template={"metadata": {"labels": {"app": "checkout"}}, "spec": {"containers": []}},
            ),
            status=SimpleNamespace(
                observed_generation=2,
                updated_replicas=2,
                available_replicas=2,
                unavailable_replicas=0,
            ),
        )

    def read_namespaced_deployment(self, name, namespace):
        return self.deployment

    def list_namespaced_replica_set(self, namespace, label_selector):
        assert namespace == "production"
        assert label_selector == "app=checkout"
        return SimpleNamespace(items=self.replica_sets)

    def patch_namespaced_deployment(self, name, namespace, body, _content_type):
        self.patches.append(body)
        if "spec" in body and "template" in body["spec"]:
            self.deployment.spec.template = body["spec"]["template"]
        return self.deployment


def make_executor(api):
    return KubernetesAutomationExecutor(
        apps_api_factory=lambda: api,
        http_transport=httpx.MockTransport(lambda request: httpx.Response(200)),
        poll_interval=0,
        max_polls=1,
    )


def test_restart_requires_explicit_per_service_opt_in():
    denied = evaluate_automation_policy(
        make_context(environment="staging", allow_restart=False), automation_enabled=True
    )
    allowed = evaluate_automation_policy(
        make_context(environment="staging", allow_restart=True), automation_enabled=True
    )

    assert not denied["allowed"]
    assert allowed["allowed"]
    assert not allowed["requires_approval"]


def test_kubernetes_restart_patches_restart_annotation_and_health_checks():
    api = FakeAppsApi()
    executor = make_executor(api)
    result = execute_automation(
        make_context(environment="staging"), executor=executor, automation_enabled=True
    )

    assert result["status"] == "succeeded"
    assert result["health_check_passed"] is True
    annotations = api.patches[0]["spec"]["template"]["metadata"]["annotations"]
    assert "kubectl.kubernetes.io/restartedAt" in annotations


def test_kubernetes_restart_dry_run_previews_target_without_mutation():
    api = FakeAppsApi()
    result = execute_automation(
        make_context(environment="staging", dry_run=True),
        executor=make_executor(api),
        automation_enabled=True,
    )

    assert result["status"] == "dry_run"
    assert result["execution_attempted"] is False
    assert result["execution_data"]["plan"]["namespace"] == "production"
    assert result["execution_data"]["plan"]["deployment"] == "checkout-api"
    assert api.patches == []


def test_kubernetes_rollback_uses_latest_earlier_healthy_replica_set():
    previous_template = {"metadata": {"labels": {"app": "checkout", "version": "1"}}, "spec": {"containers": []}}
    replica_set = SimpleNamespace(
        metadata=SimpleNamespace(
            annotations={"deployment.kubernetes.io/revision": "1"},
            owner_references=[SimpleNamespace(kind="Deployment", uid="deployment-uid")],
        ),
        status=SimpleNamespace(ready_replicas=2),
        spec=SimpleNamespace(template=previous_template),
    )
    api = FakeAppsApi(replica_sets=[replica_set])
    executor = make_executor(api)
    result = execute_automation(
        make_context(action="rollback", environment="staging"),
        executor=executor,
        automation_enabled=True,
    )

    assert result["status"] == "succeeded"
    assert api.patches[0]["spec"]["template"] == previous_template
    assert result["execution_data"]["target_revision"] == 1


def test_kubernetes_rollback_dry_run_previews_revision_without_mutation():
    previous_template = {"metadata": {"labels": {"app": "checkout", "version": "1"}}, "spec": {"containers": []}}
    replica_set = SimpleNamespace(
        metadata=SimpleNamespace(
            annotations={"deployment.kubernetes.io/revision": "1"},
            owner_references=[SimpleNamespace(kind="Deployment", uid="deployment-uid")],
        ),
        status=SimpleNamespace(ready_replicas=2),
        spec=SimpleNamespace(template=previous_template),
    )
    api = FakeAppsApi(replica_sets=[replica_set])
    result = execute_automation(
        make_context(action="rollback", environment="staging", dry_run=True),
        executor=make_executor(api),
        automation_enabled=True,
    )

    assert result["status"] == "dry_run"
    assert result["execution_data"]["plan"]["target_revision"] == 1
    assert result["execution_attempted"] is False
    assert api.patches == []


def test_production_rollback_dry_run_can_preview_without_approval():
    previous_template = {"metadata": {"labels": {"app": "checkout", "version": "1"}}, "spec": {"containers": []}}
    replica_set = SimpleNamespace(
        metadata=SimpleNamespace(
            annotations={"deployment.kubernetes.io/revision": "1"},
            owner_references=[SimpleNamespace(kind="Deployment", uid="deployment-uid")],
        ),
        status=SimpleNamespace(ready_replicas=2),
        spec=SimpleNamespace(template=previous_template),
    )
    api = FakeAppsApi(replica_sets=[replica_set])
    result = execute_automation(
        make_context(action="rollback", environment="production", dry_run=True),
        executor=make_executor(api),
        automation_enabled=True,
    )

    assert result["status"] == "dry_run"
    assert result["requires_approval"] is True
    assert api.patches == []


def test_production_rollback_still_requires_human_approval():
    result = evaluate_automation_policy(
        make_context(action="rollback", allow_rollback=True),
        automation_enabled=True,
    )

    assert not result["allowed"]
    assert result["requires_approval"]


def test_production_restart_requires_human_approval():
    result = evaluate_automation_policy(
        make_context(action="restart", environment="production", allow_restart=True),
        automation_enabled=True,
    )

    assert not result["allowed"]
    assert result["requires_approval"]
