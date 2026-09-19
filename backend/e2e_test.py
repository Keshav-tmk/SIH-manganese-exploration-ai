import httpx
import sys

BASE_URL = "http://localhost:8000/api"

def print_result(step, response):
    if response.status_code == 200:
        print(f"[SUCCESS] {step}")
    else:
        print(f"[FAILED] {step} ({response.status_code})")
        print(response.text)
        sys.exit(1)

def main():
    print("Running End-to-End API Verification...\n")
    
    # 1. Health
    r = httpx.get(f"{BASE_URL}/health")
    print_result("Backend Health", r)
    
    # 2. Model Status
    r = httpx.get(f"{BASE_URL}/model/status")
    print_result("Model Status", r)
    
    # 3. Geospatial Status
    r = httpx.get(f"{BASE_URL}/geospatial/status")
    print_result("Geospatial Status", r)
    
    # 4. Pilot Region
    r = httpx.get(f"{BASE_URL}/geospatial/pilot-region")
    print_result("Pilot Region", r)
    
    # 5. Forecast Status
    r = httpx.get(f"{BASE_URL}/forecast/status")
    print_result("Forecast Status", r)
    
    # 6. Predict Prospectivity
    payload = {
        "latitude": 15.0,
        "longitude": 76.6,
        "elevation": 500,
        "slope": 10
    }
    r = httpx.post(f"{BASE_URL}/predict", json=payload)
    print_result("Predict Prospectivity", r)
    
    # 7. Generate Forecast
    forecast_payload = {"years_ahead": 5}
    r = httpx.post(f"{BASE_URL}/forecast", json=forecast_payload)
    print_result("Generate Forecast", r)

if __name__ == "__main__":
    main()
