from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import os
import sys

# Add the parent directory to sys.path if necessary or use relative import
try:
    from app.data_pipeline.validate import validate_dataset
    from app.ml.prediction_service import ManganEXPredictor
except ImportError:
    from data_pipeline.validate import validate_dataset
    from ml.prediction_service import ManganEXPredictor

# Initialize predictor globally
# __file__ is backend/app/main.py -> dirname is backend/app -> dirname is backend -> dirname is root
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
model_dir = os.path.join(base_dir, "models")
try:
    predictor = ManganEXPredictor(model_dir=model_dir)
    MODEL_STATUS = "Online (Demo ML)"
    MODEL_ERROR = None
except Exception as e:
    predictor = None
    MODEL_STATUS = "Offline (Model Not Found)"
    MODEL_ERROR = str(e)

app = FastAPI(title="ManganEX API", description="AI-Powered Manganese Exploration & Supply Intelligence API")

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev, allow all. In production, configure properly.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictionRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude must be between -90 and 90")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude must be between -180 and 180")
    elevation: Optional[float] = None
    slope: Optional[float] = None
    vegetation_index: Optional[float] = None
    geological_feature: Optional[str] = None # Added for model

@app.get("/api/health")
def health_check():
    return {
        "status": "success",
        "message": "ManganEX backend is running"
    }

@app.get("/api/model/status")
def model_status():
    return {
        "status": MODEL_STATUS,
        "error": MODEL_ERROR,
        "is_sample_data": True,
        "disclaimer": "This is a demonstrative ML model trained on synthetic sample data. Not for scientific use."
    }

@app.post("/api/predict")
def predict_prospectivity(request: PredictionRequest):
    """
    Predicts prospectivity using the trained Random Forest model.
    """
    from fastapi import HTTPException
    
    if predictor is None:
        raise HTTPException(status_code=503, detail=f"Model service is unavailable: {MODEL_ERROR}")
    
    # Use defaults if optional fields are missing (derived from sample dataset medians)
    input_data = {
        'elevation': request.elevation if request.elevation is not None else 450.0,
        'slope': request.slope if request.slope is not None else 15.0,
        'vegetation_index': request.vegetation_index if request.vegetation_index is not None else 0.5,
        'geological_feature': request.geological_feature if request.geological_feature is not None else 'Unknown'
    }
    
    try:
        result = predictor.predict(input_data)
        
        # Calculate a pseudo-score based on probabilities for the frontend dial
        probabilities = result.get('probabilities', {})
        # Map labels: High = 1.0, Medium = 0.5, Low = 0.1
        score = (probabilities.get('High', 0) * 1.0) + (probabilities.get('Medium', 0) * 0.5) + (probabilities.get('Low', 0) * 0.1)
        
        return {
            "latitude": request.latitude,
            "longitude": request.longitude,
            "prediction_label": result.get('prediction', 'Unknown'),
            "prospectivity_score": round(score, 2),
            "priority": result.get('prediction', 'Unknown'),
            "probabilities": probabilities,
            "explanation": "Prediction based on trained ML model using synthentic features.",
            "demo_mode": True
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction failed: {str(e)}")

@app.get("/api/data/preview")
def data_preview():
    """
    Lists available datasets and their validation status.
    """
    # Assuming backend/app/main.py, data is in backend/../data
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    data_dir = os.path.join(base_dir, "data")
    datasets = []
    
    for folder in ["sample", "raw", "processed"]:
        folder_path = os.path.join(data_dir, folder)
        if os.path.exists(folder_path):
            for file_name in os.listdir(folder_path):
                if file_name.endswith(".csv"):
                    file_path = os.path.join(folder_path, file_name)
                    try:
                        report = validate_dataset(file_path)
                        datasets.append({
                            "name": file_name,
                            "folder": folder,
                            "rows": report.get("total_records", 0),
                            "columns": report.get("columns", []),
                            "is_valid": report.get("is_valid", False),
                            "errors": report.get("errors", [])
                        })
                    except Exception as e:
                        datasets.append({
                            "name": file_name,
                            "folder": folder,
                            "error": str(e)
                        })
    return {"datasets": datasets}

# Phase 9: Geospatial Endpoints

try:
    from app.data_pipeline.geospatial import is_geospatial_env_ready, PILOT_BBOX
    from app.data_pipeline.validate import validate_vector, validate_raster
except ImportError:
    from data_pipeline.geospatial import is_geospatial_env_ready, PILOT_BBOX
    from data_pipeline.validate import validate_vector, validate_raster

class GeospatialValidateRequest(BaseModel):
    file_path: str = Field(..., description="Local path to the vector or raster file in the data directory")

@app.get("/api/geospatial/status")
def geospatial_status():
    """Returns the installation status of geospatial processing libraries."""
    status = is_geospatial_env_ready()
    return {
        "status": "Online" if any(status.values()) else "Offline (Using Simulated Fallback)",
        "details": status
    }

@app.get("/api/geospatial/pilot-region")
def get_pilot_region():
    """Returns the bounding box coordinates for the Karnataka Sandur-Ballari pilot region."""
    return {
        "region_name": "Sandur-Ballari (Bellary) Manganese Mineral Belt, Karnataka, India",
        "bounding_box": PILOT_BBOX,
        "crs": "EPSG:4326"
    }

@app.post("/api/geospatial/validate")
def validate_geospatial_file(request: GeospatialValidateRequest):
    """
    Validates a spatial file against the pilot region pipeline rules.
    Restricts file access to the predefined 'data' directory for safety.
    """
    from fastapi import HTTPException
    
    safe_path = os.path.abspath(request.file_path)
    if "data" not in safe_path:
        raise HTTPException(status_code=403, detail="File path must be within the designated 'data' directory.")
        
    ext = os.path.splitext(safe_path)[1].lower()
    
    if ext in ['.shp', '.geojson', '.gpkg']:
        return validate_vector(safe_path)
    elif ext in ['.tif', '.tiff']:
        return validate_raster(safe_path)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported geospatial file extension: {ext}")

# Phase 10: Forecasting Endpoints

class ForecastRequest(BaseModel):
    years_ahead: int = Field(5, ge=1, le=20, description="Number of years to forecast into the future")

@app.get("/api/forecast/status")
def forecast_status():
    """Returns the status and metrics of the forecasting module."""
    try:
        from app.forecasting.forecaster import ManganeseForecaster
    except ImportError:
        from forecasting.forecaster import ManganeseForecaster
        
    try:
        forecaster = ManganeseForecaster()
        forecaster.load_and_clean_data()
        forecaster.train_models()
        metrics = forecaster.evaluate_models()
        
        return {
            "status": "Online",
            "model_type": "Linear Regression (Baseline)",
            "data_points": len(forecaster.df),
            "metrics": metrics,
            "disclaimer": "This module currently uses demonstration data for structural validation. Forecasts do not represent official economic or geological projections."
        }
    except Exception as e:
        return {
            "status": "Error",
            "detail": str(e)
        }

@app.post("/api/forecast")
def generate_forecast(request: ForecastRequest):
    """Generates production and demand forecasts."""
    try:
        from app.forecasting.forecaster import ManganeseForecaster
    except ImportError:
        from forecasting.forecaster import ManganeseForecaster
        
    try:
        from fastapi import HTTPException
        forecaster = ManganeseForecaster()
        forecaster.load_and_clean_data()
        forecaster.train_models()
        
        history = forecaster.get_historical_data()
        future = forecaster.forecast_future(years_ahead=request.years_ahead)
        
        # Merge both for a continuous timeline
        timeline = history + future
        
        return {
            "status": "success",
            "historical_count": len(history),
            "forecast_count": len(future),
            "data": timeline,
            "disclaimer": "Forecasts are based on demonstration data. Not for official economic planning."
        }
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

