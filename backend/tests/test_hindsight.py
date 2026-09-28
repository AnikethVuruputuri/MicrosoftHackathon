import pytest
from app.hindsight.client import HindsightService

def test_hindsight_retain_and_recall():
    service = HindsightService()
    
    retained = service.retain(
        contents="Deployment 101 failed due to PostgreSQL connection pool exhaustion. Engineer corrected Redis hypothesis.",
        memory_type="human_correction",
        tags=["payment-api", "payment_api_db_pool_production", "database_pool"],
        metadata={"failure_fingerprint": "PAYMENT_API_DB_POOL_PRODUCTION", "actual_root_cause": "PostgreSQL pool exhaustion"}
    )
    
    assert retained is not None
    assert retained["id"].startswith("mem_")
    
    recalled = service.recall(
        query="payment-api PAYMENT_API_DB_POOL_PRODUCTION",
        tags=["payment-api", "payment_api_db_pool_production"]
    )
    
    assert len(recalled) > 0
    assert "PostgreSQL" in recalled[0]["contents"]
