import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import init_db
from app.database.seed import seed_database

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()
    seed_database()

client = TestClient(app)

def test_health_endpoint():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

def test_dashboard_endpoint():
    resp = client.get("/api/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "learning_metrics" in data
    assert "historical_effectiveness" in data

def test_deployments_list():
    resp = client.get("/api/deployments")
    assert resp.status_code == 200
    assert len(resp.json()) >= 10

def test_incidents_list():
    resp = client.get("/api/incidents")
    assert resp.status_code == 200
    assert len(resp.json()) >= 5

def test_system_status():
    resp = client.get("/api/system/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["backend"] == "Operational"
    assert "groq_status" in data
    assert "hindsight_status" in data
