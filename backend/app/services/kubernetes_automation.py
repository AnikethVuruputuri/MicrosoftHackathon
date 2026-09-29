import importlib.util
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Optional

import httpx

class KubernetesAutomationExecutor:
    def __init__(
        self,
        *,
        apps_api_factory: Optional[Callable[[], Any]] = None,
        poll_interval: float = 2.0,
        max_polls: int = 60,
        http_transport: Optional[httpx.BaseTransport] = None,
    ):
        self.apps_api_factory = apps_api_factory
        self.poll_interval = poll_interval
        self.max_polls = max_polls
        self.http_transport = http_transport

    @property
    def is_configured(self) -> bool:
        if self.apps_api_factory is not None:
            return True
        if importlib.util.find_spec("kubernetes") is None:
            return False
        kubeconfig = os.getenv("KUBECONFIG")
        return bool(
            os.getenv("KUBERNETES_SERVICE_HOST")
            or (kubeconfig and Path(kubeconfig).is_file())
            or Path.home().joinpath(".kube", "config").is_file()
        )

    def _apps_api(self, context):
        if self.apps_api_factory is not None:
            return self.apps_api_factory()
        from kubernetes import client, config
        from kubernetes.config.config_exception import ConfigException

        try:
            config.load_incluster_config()
        except ConfigException:
            config.load_kube_config(context=context.kube_context or None)
        return client.AppsV1Api()

    @staticmethod
    def _require_target(context):
        if not context.kube_namespace or not context.kube_deployment:
            raise RuntimeError("Kubernetes namespace and Deployment must be configured")

    @staticmethod
    def _template_to_dict(template):
        if isinstance(template, dict):
            return template
        from kubernetes import client

        return client.ApiClient().sanitize_for_serialization(template)

    def _previous_healthy_template(self, apps_api, context, deployment):
        selector = deployment.spec.selector.match_labels or {}
        if not selector:
            raise RuntimeError("Deployment has no stable label selector; automatic rollback was blocked")
        selector_string = ",".join(f"{key}={value}" for key, value in sorted(selector.items()))
        replica_sets = apps_api.list_namespaced_replica_set(
            context.kube_namespace,
            label_selector=selector_string,
        ).items
        annotations = deployment.metadata.annotations or {}
        current_revision = int(annotations.get("deployment.kubernetes.io/revision", "0"))
        candidates = []
        for replica_set in replica_sets:
            owners = getattr(replica_set.metadata, "owner_references", None) or []
            if not any(
                getattr(owner, "kind", None) == "Deployment"
                and getattr(owner, "uid", None) == deployment.metadata.uid
                for owner in owners
            ):
                continue
            rs_annotations = replica_set.metadata.annotations or {}
            try:
                revision = int(rs_annotations.get("deployment.kubernetes.io/revision", "0"))
            except (TypeError, ValueError):
                continue
            ready_replicas = getattr(replica_set.status, "ready_replicas", 0) or 0
            if revision < current_revision and ready_replicas > 0:
                candidates.append((revision, replica_set.spec.template))
        if not candidates:
            raise RuntimeError("No earlier healthy ReplicaSet revision is available for rollback")
        revision, template = max(candidates, key=lambda item: item[0])
        return revision, self._template_to_dict(template)

    def execute(self, context) -> Dict[str, Any]:
        self._require_target(context)
        if context.provider != "kubernetes" or context.action not in {"restart", "rollback"}:
            raise RuntimeError("Kubernetes executor supports configured restart and rollback actions only")
        apps_api = self._apps_api(context)
        deployment = apps_api.read_namespaced_deployment(context.kube_deployment, context.kube_namespace)
        original_template = self._template_to_dict(deployment.spec.template)
        revision = (deployment.metadata.annotations or {}).get("deployment.kubernetes.io/revision")
        body: Dict[str, Any]
        target_revision = None

        if context.action == "restart":
            body = {
                "spec": {
                    "template": {
                        "metadata": {
                            "annotations": {
                                "kubectl.kubernetes.io/restartedAt": datetime.now(timezone.utc).isoformat()
                            }
                        }
                    }
                }
            }
        else:
            target_revision, previous_template = self._previous_healthy_template(apps_api, context, deployment)
            body = {"spec": {"template": previous_template}}

        apps_api.patch_namespaced_deployment(
            context.kube_deployment,
            context.kube_namespace,
            body,
            _content_type="application/merge-patch+json",
        )
        return {
            "provider": "kubernetes",
            "namespace": context.kube_namespace,
            "deployment": context.kube_deployment,
            "action": context.action,
            "original_template": original_template,
            "original_revision": revision,
            "target_revision": target_revision,
        }

    def plan(self, context) -> Dict[str, Any]:
        self._require_target(context)
        if context.provider != "kubernetes" or context.action not in {"restart", "rollback"}:
            raise RuntimeError("Kubernetes planning supports restart and rollback only")
        apps_api = self._apps_api(context)
        deployment = apps_api.read_namespaced_deployment(context.kube_deployment, context.kube_namespace)
        current_revision = (deployment.metadata.annotations or {}).get("deployment.kubernetes.io/revision")
        plan = {
            "provider": "kubernetes",
            "action": context.action,
            "namespace": context.kube_namespace,
            "deployment": context.kube_deployment,
            "current_revision": current_revision,
            "mutations": [],
        }
        if context.action == "restart":
            plan["mutations"] = ["Patch pod-template restart annotation; Deployment will roll pods."]
        else:
            revision, _ = self._previous_healthy_template(apps_api, context, deployment)
            plan["target_revision"] = revision
            plan["mutations"] = [f"Restore Deployment pod template from healthy revision {revision}."]
        return plan

    def _deployment_healthy(self, apps_api, context) -> bool:
        deployment = apps_api.read_namespaced_deployment(context.kube_deployment, context.kube_namespace)
        desired = deployment.spec.replicas or 1
        status = deployment.status
        observed = status.observed_generation or 0
        generation = deployment.metadata.generation or 0
        return (
            observed >= generation
            and (status.updated_replicas or 0) >= desired
            and (status.available_replicas or 0) >= desired
            and (status.unavailable_replicas or 0) == 0
        )

    def _external_health_checks_pass(self, context) -> bool:
        from app.services.automation import check_health_endpoints

        return check_health_endpoints(
            context.health_check_url,
            count=context.health_check_count,
            interval_seconds=context.health_check_interval_seconds,
            transport=self.http_transport,
        )

    def health_check(self, context, execution_data=None) -> bool:
        self._require_target(context)
        apps_api = self._apps_api(context)
        for poll in range(self.max_polls):
            try:
                if self._deployment_healthy(apps_api, context):
                    return self._external_health_checks_pass(context)
            except Exception:
                return False
            if poll + 1 < self.max_polls:
                time.sleep(self.poll_interval)
        return False

    def compensate(self, context, execution_data) -> bool:
        if not execution_data or not execution_data.get("original_template"):
            return False
        try:
            apps_api = self._apps_api(context)
            apps_api.patch_namespaced_deployment(
                context.kube_deployment,
                context.kube_namespace,
                {"spec": {"template": execution_data["original_template"]}},
                _content_type="application/merge-patch+json",
            )
            return self.health_check(context, execution_data)
        except Exception:
            return False
