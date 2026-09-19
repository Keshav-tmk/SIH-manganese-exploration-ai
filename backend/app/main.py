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
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",")] if allowed_origins_str != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictionRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude must be between -90 and 90")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude must be between -180 and 180")

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
        "is_sample_data": False,
        "disclaimer": "Model trained using Sentinel-2 spectral features and real confirmed manganese deposit proximity labels."
    }

@app.post("/api/predict")
def predict_prospectivity(request: PredictionRequest):
    """
    Predicts prospectivity using the trained Random Forest model.
    """
    from fastapi import HTTPException
    
    if predictor is None:
        raise HTTPException(status_code=503, detail=f"Model service is unavailable: {MODEL_ERROR}")
    
    input_data = {
        'latitude': request.latitude,
        'longitude': request.longitude
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
            "explanation": "Prediction based on real Sentinel-2 spectral features linked to geographic coordinates.",
            "demo_mode": False
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


# ---------------------------------------------------------------------------
# Phase 15: Multi-Region Model Training and Validation Endpoints
# ---------------------------------------------------------------------------

try:
    from app.ml.multi_region_trainer import (
        MultiRegionTrainer, MANGANESE_REGIONS, run_full_multi_region_pipeline
    )
    MULTI_REGION_AVAILABLE = True
except ImportError:
    try:
        from ml.multi_region_trainer import (
            MultiRegionTrainer, MANGANESE_REGIONS, run_full_multi_region_pipeline
        )
        MULTI_REGION_AVAILABLE = True
    except ImportError:
        MULTI_REGION_AVAILABLE = False


def _get_mr_trainer():
    """Helper that builds a MultiRegionTrainer pointed at the project models dir."""
    return MultiRegionTrainer(model_save_dir=model_dir)


@app.get("/api/multiregion/status")
def multiregion_status():
    """
    Returns the status of the multi-region training module.
    Lists all defined Indian manganese belt regions, their sample sizes,
    and whether a trained multi-region model exists on disk.
    """
    if not MULTI_REGION_AVAILABLE:
        return {
            "status": "Unavailable",
            "detail": "multi_region_trainer module could not be imported."
        }

    trainer = _get_mr_trainer()
    model_exists = trainer.model_exists()

    regions_summary = {
        key: {
            "name": val["name"],
            "state": val["state"],
            "n_samples": val["n_samples"],
            "geological_note": val["geological_note"],
            "bbox": val["bbox"],
        }
        for key, val in MANGANESE_REGIONS.items()
    }

    return {
        "status": "Online",
        "phase": "Phase 15 - Multi-Region Training and LORO Validation",
        "multi_region_model_ready": model_exists,
        "total_regions": len(MANGANESE_REGIONS),
        "total_synthetic_samples": sum(v["n_samples"] for v in MANGANESE_REGIONS.values()),
        "validation_strategy": "Leave-One-Region-Out (LORO) Cross-Validation",
        "regions": regions_summary,
        "disclaimer": (
            "Multi-region data is synthetically generated from known deposit coordinates "
            "using the same proximity-based labeling logic as the primary training pipeline."
        ),
    }


@app.post("/api/multiregion/train")
def multiregion_train(force_regenerate: bool = False):
    """
    Triggers the full Phase 15 multi-region training pipeline:
      1. Generates (or loads cached) synthetic region data for all 6 belts
      2. Runs Leave-One-Region-Out cross-validation
      3. Trains a final generalized model on all regions
      4. Saves artifacts to models/multi_region/

    Set force_regenerate=true to rebuild training data from scratch.
    Returns the LORO aggregate metrics and per-fold breakdown.
    """
    from fastapi import HTTPException

    if not MULTI_REGION_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="multi_region_trainer module is not available."
        )

    try:
        report = run_full_multi_region_pipeline(
            model_save_dir=model_dir,
            force_regenerate=force_regenerate,
        )
        agg = report.get("aggregate_loro_metrics", {})
        return {
            "status": "success",
            "message": "Phase 15 multi-region training complete.",
            "aggregate_loro_metrics": agg,
            "n_folds": agg.get("n_folds", 0),
            "mean_f1_score": agg.get("mean_f1_score"),
            "mean_accuracy": agg.get("mean_accuracy"),
            "artifacts_dir": os.path.join(model_dir, "multi_region"),
            "disclaimer": report.get("disclaimer", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Multi-region training failed: {str(e)}")


@app.get("/api/multiregion/results")
def multiregion_results():
    """
    Returns the saved LORO evaluation report from the last training run.
    Includes per-fold metrics by region, aggregate statistics,
    and feature importance from the final generalized model.
    Raises 404 if training has not been run yet (POST /api/multiregion/train first).
    """
    from fastapi import HTTPException

    if not MULTI_REGION_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="multi_region_trainer module is not available."
        )

    try:
        trainer = _get_mr_trainer()
        report = trainer.load_evaluation_report()
        return {
            "status": "success",
            "report": report,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Phase 16: Multi-Region Location-Based Prediction
# ---------------------------------------------------------------------------

# Lazy-initialise the Phase 16 predictor (requires Phase 15 training artifacts)
_mr_predictor = None
_mr_predictor_error: Optional[str] = None


def _get_mr_predictor():
    """
    Returns the singleton MultiRegionPredictor, initialising it on first call.
    Raises HTTPException(503) if the Phase 15 model artifacts are not found.
    """
    global _mr_predictor, _mr_predictor_error
    from fastapi import HTTPException

    if _mr_predictor is not None:
        return _mr_predictor

    try:
        from app.ml.multiregion_predictor import MultiRegionPredictor
    except ImportError:
        from ml.multiregion_predictor import MultiRegionPredictor

    try:
        _mr_predictor = MultiRegionPredictor(model_dir=model_dir)
        _mr_predictor_error = None
    except FileNotFoundError as e:
        _mr_predictor_error = str(e)
        raise HTTPException(
            status_code=503,
            detail=(
                "Phase 15 multi-region model not found. "
                "Run POST /api/multiregion/train first to generate model artifacts. "
                f"Details: {_mr_predictor_error}"
            ),
        )
    return _mr_predictor


@app.post("/api/predict/multiregion")
def predict_multiregion(request: PredictionRequest):
    """
    Phase 16: Location-based prospectivity prediction using the Phase 15
    multi-region Random Forest model.

    Accepts latitude and longitude (same schema as /api/predict).
    Returns:
      - prediction_label, prospectivity_score, probabilities (if inside a
        supported region)
      - region_name, state, geological_note, nearest_deposit_name/dist_km
      - is_validated_region: False + message if outside all 6 supported regions
      - data_source and disclaimer for transparency

    Coordinate validation: -90 ≤ lat ≤ 90, -180 ≤ lon ≤ 180 (Pydantic)
    Unsupported regions: HTTP 200 with is_validated_region=False (not 4xx)
    """
    predictor_p16 = _get_mr_predictor()
    try:
        result = predictor_p16.predict(request.latitude, request.longitude)
        return result
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=f"Multi-region prediction failed: {str(e)}"
        )


@app.get("/api/predict/multiregion/regions")
def multiregion_regions():
    """
    Phase 16: Returns metadata for all 6 supported Indian manganese belt
    regions, including bounding boxes and geological notes.
    Does not require the Phase 15 model to be trained.
    """
    try:
        from app.ml.multiregion_predictor import get_supported_regions
    except ImportError:
        from ml.multiregion_predictor import get_supported_regions

    return {
        "status": "success",
        "total_regions": 6,
        "regions": get_supported_regions(),
        "note": (
            "These are the regions for which the Phase 15 multi-region "
            "RF model can generate predictions. Coordinates outside these "
            "bounding boxes will receive is_validated_region=False."
        ),
    }
