import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app, predictor, MODEL_STATUS

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_model_status():
    response = client.get("/api/model/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "error" in data

def test_predict_endpoint():
    payload = {
        "latitude": 15.1,
        "longitude": 76.5,
        "region": "Sandur"
    }
    response = client.post("/api/predict", json=payload)
    
    # Depending on whether the model is loaded or not, this could return 200 or 503
    if predictor is None:
        assert response.status_code == 503
    else:
        assert response.status_code == 200
        data = response.json()
        assert "prospectivity_score" in data
        assert "prediction_label" in data

def test_predict_invalid_latitude():
    payload = {
        "latitude": 95.0, # invalid
        "longitude": 76.5
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 422 # Pydantic validation error

def test_predict_invalid_longitude():
    payload = {
        "latitude": 15.0, 
        "longitude": -190.0 # invalid
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 422

def test_forecast_status():
    response = client.get("/api/forecast/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    # "metrics" is present if status is Online
    if data["status"] == "Online":
        assert "metrics" in data
    else:
        assert "detail" in data

def test_forecast_valid():
    payload = {
        "years_ahead": 5
    }
    response = client.post("/api/forecast", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data

def test_forecast_invalid_years():
    payload = {
        "years_ahead": -1
    }
    response = client.post("/api/forecast", json=payload)
    assert response.status_code == 422

    payload2 = {
        "years_ahead": 50
    }
    response = client.post("/api/forecast", json=payload2)
    assert response.status_code == 422
