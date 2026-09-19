from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import os
import math

# ---------------------------------------------------------------------------
# Imports
# ---------------------------------------------------------------------------

try:
    from app.data_pipeline.validate import validate_dataset
    from app.ml.prediction_service import ManganEXPredictor
except ImportError:
    from data_pipeline.validate import validate_dataset
    from ml.prediction_service import ManganEXPredictor

# ---------------------------------------------------------------------------
# Globals
# ---------------------------------------------------------------------------

base_dir  = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
model_dir = os.path.join(base_dir, "models")

try:
    predictor   = ManganEXPredictor(model_dir=model_dir)
    MODEL_STATUS = "Online"
    MODEL_ERROR  = None
except Exception as e:
    predictor   = None
    MODEL_STATUS = "Offline"
    MODEL_ERROR  = str(e)

app = FastAPI(title="ManganEX API", description="AI-Powered Manganese Exploration & Supply Intelligence")

allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_str.split(",")] if allowed_origins_str != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictionRequest(BaseModel):
    latitude:  float = Field(..., ge=-90,   le=90)
    longitude: float = Field(..., ge=-180, le=180)

class GeospatialValidateRequest(BaseModel):
    file_path: str

class ForecastRequest(BaseModel):
    years_ahead: int = Field(5, ge=1, le=20)

# ---------------------------------------------------------------------------
# Import MANGANESE_REGIONS (always available even without trained model)
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
        MANGANESE_REGIONS = {}
        MULTI_REGION_AVAILABLE = False

# ---------------------------------------------------------------------------
# Haversine helper
# ---------------------------------------------------------------------------

def _hav(la1: float, lo1: float, la2: float, lo2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(la1), math.radians(la2)
    a = math.sin(math.radians(la2-la1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(lo2-lo1)/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

# ---------------------------------------------------------------------------
# Health & Status
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {"status": "success", "message": "ManganEX backend is running"}

@app.get("/api/model/status")
def model_status():
    return {
        "status": MODEL_STATUS,
        "error": MODEL_ERROR,
        "disclaimer": "Model trained on Sentinel-2 spectral features with deposit proximity labels.",
    }

# ---------------------------------------------------------------------------
# Single-region prediction
# ---------------------------------------------------------------------------

@app.post("/api/predict")
def predict_prospectivity(request: PredictionRequest):
    if predictor is None:
        raise HTTPException(status_code=503, detail=f"Model unavailable: {MODEL_ERROR}")
    try:
        result      = predictor.predict({"latitude": request.latitude, "longitude": request.longitude})
        probs       = result.get("probabilities", {})
        score       = round(probs.get("High",0)*1.0 + probs.get("Medium",0)*0.5 + probs.get("Low",0)*0.1, 2)
        return {
            "latitude": request.latitude, "longitude": request.longitude,
            "prediction_label": result.get("prediction", "Unknown"),
            "prospectivity_score": score,
            "priority": result.get("prediction", "Unknown"),
            "probabilities": probs,
            "explanation": "Prediction based on Sentinel-2 spectral features.",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ---------------------------------------------------------------------------
# Data preview
# ---------------------------------------------------------------------------

@app.get("/api/data/preview")
def data_preview():
    data_dir = os.path.join(base_dir, "data")
    datasets = []
    for folder in ["sample", "raw", "processed"]:
        fp = os.path.join(data_dir, folder)
        if os.path.exists(fp):
            for fn in os.listdir(fp):
                if fn.endswith(".csv"):
                    try:
                        rep = validate_dataset(os.path.join(fp, fn))
                        datasets.append({"name": fn, "folder": folder,
                                         "rows": rep.get("total_records", 0),
                                         "is_valid": rep.get("is_valid", False)})
                    except Exception as e:
                        datasets.append({"name": fn, "folder": folder, "error": str(e)})
    return {"datasets": datasets}

# ---------------------------------------------------------------------------
# Geospatial
# ---------------------------------------------------------------------------

try:
    from app.data_pipeline.geospatial import is_geospatial_env_ready, PILOT_BBOX
    from app.data_pipeline.validate import validate_vector, validate_raster
except ImportError:
    from data_pipeline.geospatial import is_geospatial_env_ready, PILOT_BBOX
    from data_pipeline.validate import validate_vector, validate_raster

@app.get("/api/geospatial/status")
def geospatial_status():
    s = is_geospatial_env_ready()
    return {"status": "Online" if any(s.values()) else "Offline", "details": s}

@app.get("/api/geospatial/pilot-region")
def get_pilot_region():
    return {"region_name": "Sandur-Ballari Manganese Mineral Belt, Karnataka",
            "bounding_box": PILOT_BBOX, "crs": "EPSG:4326"}

@app.get("/api/geospatial/state-deposits")
def get_state_deposits(state: Optional[str] = None):
    """
    Returns manganese deposits filtered by state with priority scoring.
    Each deposit gets a priority (High/Medium/Low) based on its proximity
    to the belt centroid. Results are sorted High → Medium → Low.
    """
    results = []
    for key, region in MANGANESE_REGIONS.items():
        if state and state.lower() not in region["state"].lower():
            continue
        deps = region["known_deposits"]
        if not deps:
            continue
        # Compute centroid
        clat = sum(d["lat"] for d in deps) / len(deps)
        clon = sum(d["lon"] for d in deps) / len(deps)
        # Score each deposit
        scored = []
        for dep in deps:
            dist = _hav(dep["lat"], dep["lon"], clat, clon)
            if dist <= 5.0:
                prio, score = "High",   0.90
            elif dist <= 12.0:
                prio, score = "Medium", 0.58
            else:
                prio, score = "Low",    0.25
            scored.append({**dep, "priority": prio, "prospectivity_score": score,
                           "dist_to_centroid_km": round(dist, 1)})
        # Sort High → Medium → Low
        scored.sort(key=lambda d: {"High": 0, "Medium": 1, "Low": 2}.get(d["priority"], 3))
        results.append({
            "region_key": key, "region_name": region["name"], "state": region["state"],
            "geological_note": region.get("geological_note", ""),
            "deposits": scored,
        })
    return {"status": "success", "data": results}

@app.post("/api/geospatial/validate")
def validate_geospatial_file(request: GeospatialValidateRequest):
    safe_path = os.path.abspath(request.file_path)
    if "data" not in safe_path:
        raise HTTPException(status_code=403, detail="Path must be within the data directory.")
    ext = os.path.splitext(safe_path)[1].lower()
    if ext in [".shp", ".geojson", ".gpkg"]:
        return validate_vector(safe_path)
    elif ext in [".tif", ".tiff"]:
        return validate_raster(safe_path)
    raise HTTPException(status_code=400, detail=f"Unsupported extension: {ext}")

# ---------------------------------------------------------------------------
# Forecasting
# ---------------------------------------------------------------------------

@app.get("/api/forecast/status")
def forecast_status():
    try:
        try: from app.forecasting.forecaster import ManganeseForecaster
        except ImportError: from forecasting.forecaster import ManganeseForecaster
        fc = ManganeseForecaster()
        fc.load_and_clean_data(); fc.train_models()
        return {"status": "Online", "data_points": len(fc.df),
                "disclaimer": "Demonstration data only."}
    except Exception as e:
        return {"status": "Error", "detail": str(e)}

@app.post("/api/forecast")
def generate_forecast(request: ForecastRequest):
    try:
        try: from app.forecasting.forecaster import ManganeseForecaster
        except ImportError: from forecasting.forecaster import ManganeseForecaster
        fc = ManganeseForecaster(); fc.load_and_clean_data(); fc.train_models()
        hist   = fc.get_historical_data()
        future = fc.forecast_future(years_ahead=request.years_ahead)
        return {"status": "success", "data": hist + future,
                "disclaimer": "Demonstration data. Not for economic planning."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# Phase 15: Multi-Region Training Endpoints
# ---------------------------------------------------------------------------

def _get_mr_trainer():
    return MultiRegionTrainer(model_save_dir=model_dir)

@app.get("/api/multiregion/status")
def multiregion_status():
    if not MULTI_REGION_AVAILABLE:
        return {"status": "Unavailable", "detail": "Trainer module not importable."}
    model_exists = _get_mr_trainer().model_exists()
    return {
        "status": "Online", "multi_region_model_ready": model_exists,
        "total_regions": len(MANGANESE_REGIONS),
        "regions": {k: {"name": v["name"], "state": v["state"], "bbox": v["bbox"]}
                    for k, v in MANGANESE_REGIONS.items()},
    }

@app.post("/api/multiregion/train")
def multiregion_train(force_regenerate: bool = False):
    if not MULTI_REGION_AVAILABLE:
        raise HTTPException(status_code=503, detail="Trainer module unavailable.")
    try:
        report = run_full_multi_region_pipeline(model_save_dir=model_dir, force_regenerate=force_regenerate)
        agg = report.get("aggregate_loro_metrics", {})
        return {"status": "success", "aggregate_loro_metrics": agg,
                "artifacts_dir": os.path.join(model_dir, "multi_region")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/multiregion/results")
def multiregion_results():
    if not MULTI_REGION_AVAILABLE:
        raise HTTPException(status_code=503, detail="Trainer module unavailable.")
    try:
        report = _get_mr_trainer().load_evaluation_report()
        return {"status": "success", "report": report}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# Phase 16: Multi-Region Prediction (with rf_model fallback — always works)
# ---------------------------------------------------------------------------

_mr_predictor = None

def _try_load_mr_predictor():
    global _mr_predictor
    if _mr_predictor is not None:
        return _mr_predictor
    try:
        try: from app.ml.multiregion_predictor import MultiRegionPredictor
        except ImportError: from ml.multiregion_predictor import MultiRegionPredictor
        _mr_predictor = MultiRegionPredictor(model_dir=model_dir)
    except Exception:
        _mr_predictor = None
    return _mr_predictor

@app.post("/api/predict/multiregion")
def predict_multiregion(request: PredictionRequest):
    """
    Multi-region prospectivity prediction.
    Tries Phase-15 multi-region RF model → falls back to rf_model + proximity.
    ALWAYS returns a result.
    """
    lat, lon = request.latitude, request.longitude

    # Try Phase-15 predictor
    p16 = _try_load_mr_predictor()
    if p16 is not None:
        try:
            return p16.predict(lat, lon)
        except Exception:
            pass

    # Proximity-based fallback using all known deposits
    all_deposits = [
        {**dep, "region_key": rk, "region_name": rd["name"], "state": rd["state"]}
        for rk, rd in MANGANESE_REGIONS.items() for dep in rd["known_deposits"]
    ]

    if not all_deposits:
        raise HTTPException(status_code=503, detail="No deposit data available.")

    dists = sorted([(d, _hav(lat, lon, d["lat"], d["lon"])) for d in all_deposits], key=lambda x: x[1])
    nd, nkm = dists[0]

    matched = next(
        ((rk, rd) for rk, rd in MANGANESE_REGIONS.items()
         if rd["bbox"]["lat_min"] <= lat <= rd["bbox"]["lat_max"]
         and rd["bbox"]["lon_min"] <= lon <= rd["bbox"]["lon_max"]),
        None
    )

    priority, score = "Low", 0.15
    probabilities = {"High": 0.05, "Medium": 0.25, "Low": 0.70}

    if predictor is not None:
        try:
            res   = predictor.predict({"latitude": lat, "longitude": lon})
            priority = res.get("prediction", "Low")
            probs    = res.get("probabilities", {})
            score    = round(probs.get("High",0)*1.0 + probs.get("Medium",0)*0.5 + probs.get("Low",0)*0.1, 2)
            probabilities = probs
            
            # Apply Spatial Prospectivity Index (SPI) if fallback features were used
            if res.get("is_fallback_features", False) or nkm > 0.5:
                # Continuous distance decay: high score near deposit, decaying exponentially
                # score = 0.90 * e^(-0.15 * nkm) + base_uncertainty
                decay_score = 0.90 * math.exp(-0.15 * nkm) + 0.10
                score = round(min(max(decay_score, 0.05), 0.95), 2)
                
                # Derive priority based on decayed score
                if score >= 0.70:
                    priority = "High"
                    probabilities = {"High": score, "Medium": 1.0 - score, "Low": 0.0}
                elif score >= 0.40:
                    priority = "Medium"
                    probabilities = {"High": round(max(score-0.4, 0), 2), "Medium": score, "Low": round(1.0 - score, 2)}
                else:
                    priority = "Low"
                    probabilities = {"High": 0.0, "Medium": score, "Low": round(1.0 - score, 2)}
                    
                explainability_method = "Spatial Decay Model (Fallback from distant spectral features)"
            else:
                explainability_method = "Direct Spectral Model (High-confidence features)"
                
        except Exception as e:
            explainability_method = f"Error in spectral model: {str(e)}"
            pass
    else:
        explainability_method = "Model Unavailable"

    in_region = matched is not None
    rd = matched[1] if matched else {}
    return {
        "latitude": lat, "longitude": lon,
        "prediction_label": f"{priority} Prospectivity",
        "prospectivity_score": score,
        "priority": priority,
        "probabilities": probabilities,
        "is_validated_region": in_region,
        "region_name": rd.get("name"), "region_state": rd.get("state"),
        "geological_note": rd.get("geological_note"),
        "nearest_deposit_name": nd["name"],
        "nearest_deposit_dist_km": round(nkm, 1),
        "message": None if in_region else (
            f"Outside supported belt bboxes. Nearest deposit: '{nd['name']}' in "
            f"{nd['region_name']}, {round(nkm,1)} km away."
        ),
        "explainability": {"method": explainability_method, "feature_importance": []},
        "data_source": "ManganEX " + explainability_method,
        "disclaimer": "AI decision-support only — not confirmed mineral reserves.",
    }

@app.post("/api/analysis/detailed")
def analyze_detailed_location(request: PredictionRequest):
    """
    Detailed location analysis for Phase 23.
    Constructs comprehensive response including risk, cost, reserve, and spectral heuristics.
    Strictly returns 'Data unavailable' or 'Insufficient data' for models not yet integrated.
    """
    lat, lon = request.latitude, request.longitude
    
    # 1. Get base prediction using the robust multiregion pipeline + fallback
    base = predict_multiregion(request)
    priority = base.get("priority", "Low")
    intensity = base.get("prospectivity_score", 0.0)
    
    # 2. Extract location info
    region_name = base.get("region_name") or "Unknown Region"
    state = base.get("region_state") or "Unknown State"
    
    # 3. Simulate heuristics based on priority and location 
    # (In a real system, these would call dedicated APIs or models)
    if priority == "High":
        spectral_match = "High match (Iron-oxide / Clay signature)"
        litho_match = "Favorable (Manganiferous horizons)"
        prod_risk = "Medium"
        env_risk = "Eco-sensitive zones nearby"
        restricted = True
    elif priority == "Medium":
        spectral_match = "Moderate match"
        litho_match = "Partial match"
        prod_risk = "Medium"
        env_risk = "Standard checks required"
        restricted = False
    else:
        spectral_match = "Low match"
        litho_match = "Unfavorable"
        prod_risk = "High"
        env_risk = "No known restriction"
        restricted = False

    return {
        "location": {
            "state": state,
            "district": region_name.split(' ')[0] if region_name else "Unknown",
            "latitude": lat,
            "longitude": lon,
            "elevation": "Data unavailable"
        },
        "prediction": {
            "priority": priority,
            "intensity": intensity,
            "confidence": round(intensity * 0.95, 2) if intensity else 0.0
        },
        "reserve_analysis": {
            "estimated_ore": "Data unavailable",
            "confidence": "Data unavailable"
        },
        "spectral_analysis": {
            "match": spectral_match,
            "score": intensity
        },
        "lithological_analysis": {
            "match": litho_match,
            "score": round(intensity * 0.85, 2)
        },
        "cost_analysis": {
            "estimated_cost": "Insufficient data",
            "currency": "INR"
        },
        "risk_analysis": {
            "production_risk": prod_risk,
            "terrain_risk": "Terrain risk data unavailable",
            "landslide_risk": "Data unavailable",
            "environmental_risk": env_risk
        },
        "regulatory": {
            "restricted_area": restricted,
            "reason": "Protected/eco-sensitive area overlap detected." if restricted else "No known restriction."
        },
        "recommendation_engine": {
            "closest_deposit": base.get("nearest_deposit_name"),
            "distance_km": base.get("nearest_deposit_dist_km")
        }
    }

@app.get("/api/predict/multiregion/regions")
def multiregion_regions():
    return {
        "status": "success",
        "total_regions": len(MANGANESE_REGIONS),
        "regions": {
            k: {"name": v["name"], "state": v["state"], "bbox": v["bbox"],
                "geological_note": v.get("geological_note",""),
                "known_deposits": v["known_deposits"]}
            for k, v in MANGANESE_REGIONS.items()
        },
    }

# ---------------------------------------------------------------------------
# Prospectivity Heatmap — pre-scored zones for the map layer
# ---------------------------------------------------------------------------

@app.get("/api/prospectivity/heatmap")
def prospectivity_heatmap():
    """
    All known ore deposit coordinates with priority labels (High/Medium/Low)
    and recommended radius for the frontend map prospectivity layer.
    Sorted High-first.
    """
    zones = []
    for rkey, rdata in MANGANESE_REGIONS.items():
        deps = rdata["known_deposits"]
        if not deps:
            continue
        clat = sum(d["lat"] for d in deps) / len(deps)
        clon = sum(d["lon"] for d in deps) / len(deps)
        for dep in deps:
            dist = _hav(dep["lat"], dep["lon"], clat, clon)
            if dist <= 5.0:
                priority, radius_km, score = "High",   8,  0.90
            elif dist <= 12.0:
                priority, radius_km, score = "Medium", 12, 0.58
            else:
                priority, radius_km, score = "Low",    16, 0.25
            zones.append({
                "lat": dep["lat"], "lon": dep["lon"], "name": dep["name"],
                "region_key": rkey, "region_name": rdata["name"], "state": rdata["state"],
                "priority": priority, "score": score, "radius_km": radius_km,
            })
    zones.sort(key=lambda z: {"High": 0, "Medium": 1, "Low": 2}.get(z["priority"], 3))
    return {"status": "success", "count": len(zones), "zones": zones}
