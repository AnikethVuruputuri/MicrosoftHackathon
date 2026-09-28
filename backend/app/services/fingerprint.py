import re
import hashlib
from typing import Optional, List, Dict, Any

class FailureFingerprintEngine:
    """
    Deterministic Failure Fingerprint Engine.
    Synthesizes service, environment, changed components, error symptoms,
    infrastructure dependencies, and configuration changes into a structured,
    normalized, and deterministic operational fingerprint.
    """

    @staticmethod
    def normalize_string(val: Optional[str]) -> str:
        if not val:
            return ""
        # Uppercase, replace non-alphanumeric with underscores, strip duplicate underscores
        s = re.sub(r'[^a-zA-Z0-9]', '_', val.strip().upper())
        s = re.sub(r'_+', '_', s)
        return s.strip('_')

    @classmethod
    def extract_error_category(cls, logs: str, symptoms: str) -> str:
        text = f"{logs} {symptoms}".lower()
        if "pool" in text or "connection limit" in text or "exhausted" in text or "max connections" in text:
            return "DB_POOL_EXHAUSTION"
        elif "redis" in text or "timeout" in text or "socket timeout" in text or "connection refused" in text:
            return "TIMEOUT_CONNECTION_ERROR"
        elif "nullpointer" in text or "panic" in text or "syntaxerror" in text or "unhandled exception" in text:
            return "RUNTIME_CRASH"
        elif "env" in text or "missing key" in text or "undefined variable" in text:
            return "CONFIG_ENV_MISSING"
        elif "out of memory" in text or "oom" in text or "killed" in text:
            return "RESOURCE_OOM"
        elif "dependency" in text or "module not found" in text or "version conflict" in text:
            return "DEPENDENCY_CONFLICT"
        return "GENERAL_DEPLOYMENT_FAILURE"

    @classmethod
    def extract_component(cls, service: str, component: Optional[str], logs: str, changed_files: List[str]) -> str:
        if component:
            norm = cls.normalize_string(component)
            if "DATABASE_POOL" in norm or "DB_POOL" in norm:
                return "DB_POOL"
            elif "REDIS" in norm or "CACHE" in norm:
                return "CACHE_LAYER"
            elif "AUTH" in norm or "JWT" in norm:
                return "AUTH_MODULE"
            return norm
        
        all_text = (logs + " " + " ".join(changed_files)).lower()
        if "pool" in all_text or "database" in all_text or "postgres" in all_text or "db" in all_text:
            return "DB_POOL"
        elif "redis" in all_text or "cache" in all_text:
            return "CACHE_LAYER"
        elif "auth" in all_text or "jwt" in all_text:
            return "AUTH_MODULE"
        elif "kafka" in all_text or "queue" in all_text:
            return "MESSAGE_BROKER"
        
        return "CORE_SERVICE"

    @classmethod
    def generate(
        cls,
        service_name: str,
        environment: str = "production",
        component: Optional[str] = None,
        error_category: Optional[str] = None,
        changed_files: Optional[List[str]] = None,
        logs: Optional[str] = None,
        symptoms: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generates deterministic failure fingerprint and breakdown attributes.
        """
        norm_service = cls.normalize_string(service_name)
        norm_env = cls.normalize_string(environment) or "PRODUCTION"
        
        c_files = changed_files or []
        log_str = logs or ""
        sym_str = symptoms or ""

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
