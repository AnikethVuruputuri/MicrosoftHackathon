import pytest
from app.services.fingerprint import FailureFingerprintEngine

def test_deterministic_failure_fingerprint():
    fp1 = FailureFingerprintEngine.generate(
        service_name="payment-api",
        environment="production",
        component="database_pool",
        logs="PoolAcquireTimeoutError: queue pool limit reached",
        symptoms="Redis timeout and 504 Gateway error"
    )
    
    fp2 = FailureFingerprintEngine.generate(
        service_name="payment-api",
        environment="production",
        component="database_pool",
        logs="PoolAcquireTimeoutError: queue pool limit reached",
        symptoms="Redis timeout and 504 Gateway error"
    )

    assert fp1["fingerprint"] == fp2["fingerprint"]
    assert fp1["fingerprint"] == "PAYMENT_API_DB_POOL_PRODUCTION"
    assert fp1["hash"] == fp2["hash"]

def test_category_inference():
    cat = FailureFingerprintEngine.extract_error_category(
        logs="RedisConnectionTimeout: Connection timed out",
        symptoms="Gateway timeout"
    )
    assert cat == "TIMEOUT_CONNECTION_ERROR"
