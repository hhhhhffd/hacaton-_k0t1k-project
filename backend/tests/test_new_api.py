import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_get_global_shap():
    """Тест для получения Global SHAP."""
    with TestClient(app) as client:
        response = client.get("/api/global-shap")
        assert response.status_code in (200, 401, 503)
        if response.status_code == 200:
            data = response.json()
            assert "feature_importance" in data
            assert isinstance(data["feature_importance"], dict)

def test_proactive_offers():
    """Тест для получения proactive offers."""
    with TestClient(app) as client:
        response = client.get("/api/proactive-offers")
        assert response.status_code in (200, 401, 503)
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
