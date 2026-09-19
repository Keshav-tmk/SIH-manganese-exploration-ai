# Phase 6: Prediction Pipeline Integration

## Overview
Phase 6 connects the FastAPI backend and the React frontend to the trained Random Forest machine learning model built in Phase 5. This replaces the initial dummy logic with real inference capabilities.

## Architecture

1. **Frontend (`App.jsx`, `api.js`)**
   - Coordinates (Latitude, Longitude) and Optional features (Elevation, Slope, Vegetation Index, Geological Feature) are collected from the user interface.
   - A new indicator displays the real-time **Model Status** (e.g., "Online (Demo ML)").
   - The payload is sent to the backend via a POST request to `/api/predict`.

2. **Backend (`main.py`)**
   - The `ManganEXPredictor` is initialized on startup, preloading the `rf_model.joblib` and `preprocessor.joblib`.
   - If optional features are missing, the backend safely defaults them using medians from the training dataset.
   - The endpoint translates the Random Forest class probabilities (`High`, `Medium`, `Low`) into a unified `prospectivity_score` between 0.0 and 1.0.

3. **Machine Learning Service (`prediction_service.py`)**
   - Extracts the required raw features.
   - Applies the `ColumnTransformer` (which now correctly includes `StandardScaler` for continuous variables like elevation and slope, and `OneHotEncoder` for categorical features like geological structures).
   - Runs model inference and returns the predicted label and class probabilities.

## ML Pipeline Fixes
During Phase 6 integration, an architectural discontinuity was identified:
- The Phase 4 pipeline scaled features but didn't persist the `StandardScaler`.
- To allow the frontend to submit raw, unscaled inputs (e.g., Elevation in meters), the Phase 5 `dataset_prep.py` was updated to incorporate a `StandardScaler` directly within its `ColumnTransformer`. 
- The model was retrained to handle raw inputs natively, ensuring continuous compatibility from user input to ML inference.

## Limitations (Demo Mode)
- The ML model is currently trained on a *synthetic* dataset (`manganex_sample_data.csv`).
- The predictions provided by the pipeline are for **demonstration purposes only** and must not be used for real-world geological extraction operations without integrating a scientifically validated dataset.
