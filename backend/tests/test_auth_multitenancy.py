import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import init_db
from app.database.seed import seed_database
from app.hindsight.client import hindsight_service

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()
    seed_database()

client = TestClient(app)

def test_user_registration_and_login():
    unique_id = str(uuid.uuid4())[:8]
    email = f"sarah_{unique_id}@cyberdyne.io"
    org_name = f"Cyberdyne_{unique_id}"

    reg_resp = client.post(
        "/api/auth/register",
        json={
            "name": "Sarah Connor",
            "email": email,
            "password": "SecurePassword123!",
            "org_name": org_name
        }
    )
    assert reg_resp.status_code == 200
    token = reg_resp.json()["access_token"]
    assert token is not None

    # Login with credentials
    login_resp = client.post(
        "/api/auth/login",
        json={
            "email": email,
            "password": "SecurePassword123!"
        }
    )
    assert login_resp.status_code == 200
    assert login_resp.json()["access_token"] is not None

def test_hindsight_tenant_isolation():
    # Retain memory for Org 1 (Acme Corp)
    hindsight_service.retain(
        contents="Confidential incident note for Acme Corp only.",
        memory_type="incident",
        tags=["acme", "confidential"],
        metadata={"incident_code": "INC-ACME-01"},
        org_id=1
    )

    # Retain memory for Org 2 (Cyberdyne)
    hindsight_service.retain(
        contents="Confidential incident note for Cyberdyne Systems only.",
        memory_type="incident",
        tags=["cyberdyne", "confidential"],
        metadata={"incident_code": "INC-CYBER-01"},
        org_id=2
    )

    # Query as Org 1
    recalled_org_1 = hindsight_service.recall("Confidential", org_id=1)
    assert all(m.get("org_id", 1) == 1 for m in recalled_org_1)
    assert not any("Cyberdyne" in m.get("contents", "") for m in recalled_org_1)

    # Query as Org 2
    recalled_org_2 = hindsight_service.recall("Confidential", org_id=2)
    assert all(m.get("org_id", 1) == 2 for m in recalled_org_2)
    assert not any("Acme" in m.get("contents", "") for m in recalled_org_2)
