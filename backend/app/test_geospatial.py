import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.data_pipeline.geospatial import is_geospatial_env_ready, PILOT_BBOX
from app.data_pipeline.validate import validate_vector, validate_raster
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_status():
    print("Testing /api/geospatial/status")
    response = client.get("/api/geospatial/status")
    print(response.json())
    assert response.status_code == 200

def test_pilot_region():
    print("Testing /api/geospatial/pilot-region")
    response = client.get("/api/geospatial/pilot-region")
    data = response.json()
    print(data)
    assert response.status_code == 200
    assert "region_name" in data
    assert "bounding_box" in data

def test_simulate_vector_validation():
    print("Testing /api/geospatial/validate with simulated missing vector file")
    
    # We create a dummy test file in data folder
    test_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'test.shp'))
    os.makedirs(os.path.dirname(test_file_path), exist_ok=True)
    
    # We just touch the file so it exists
    with open(test_file_path, 'w') as f:
        f.write("dummy")

    try:
        response = client.post("/api/geospatial/validate", json={"file_path": test_file_path})
        print(response.json())
        assert response.status_code == 200
        # If running in simulated mode, it should simulate it successfully or report invalid file format
        data = response.json()
        assert "is_valid" in data
    finally:
        if os.path.exists(test_file_path):
            os.remove(test_file_path)

