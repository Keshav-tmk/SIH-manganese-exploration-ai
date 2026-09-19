# Phase 5: Machine Learning Baseline Model

This document outlines the initial machine learning pipeline developed for ManganEX in Phase 5. The objective is to build a robust, reproducible Random Forest classifier pipeline that predicts geological prospectivity based on preprocessed terrain, vegetation, and lithological features.

## 1. Model Objective
To classify the `prospectivity_label` (High, Medium, Low) of a geological region based on derived structural and surface features, establishing a baseline structural architecture for future real-world geological data integration.

## 2. Dataset Used
- **Type:** Synthetic / Sample demonstration data.
- **Size:** 7 records (Pipeline mechanics testing only).
- **Location:** `data/features/features_X.csv` and `data/features/labels_y.csv`.

> [!WARNING]
> **Sample Data Limitation:** The current dataset consists of purely synthetic/sample values. The trained model evaluate the *mechanics* of the pipeline (data loading, encoding, splitting, training, predicting). The resulting performance metrics and feature importances do **NOT** establish real-world geological prediction accuracy and should not be used for scientific conclusions until real data is ingested.

## 3. Data Schema
### Feature Columns (X)
To prevent spatial overfitting, raw `latitude` and `longitude` are excluded from the model training features.
1. `elevation_scaled` (Numeric): Standardized elevation.
2. `slope_scaled` (Numeric): Standardized slope.
3. `vegetation_index` (Numeric): Measure of surface vegetation density.
4. `geological_feature` (Categorical): Dominant lithology (e.g., Basalt, Limestone).

### Target Column (y)
- `prospectivity_label` (Categorical String): High, Medium, or Low.

## 4. Pipeline Architecture
The pipeline is contained within `backend/app/ml/` and follows these steps:
1. **Dataset Preparation (`dataset_prep.py`):**
   - Validates the presence of the target column.
   - Drops any rows missing targets.
   - Encodes `geological_feature` using `OneHotEncoder(handle_unknown='ignore')`.
   - Safely handles small sample sizes by falling back to random splits if stratified splitting is mathematically impossible.
2. **Model Training (`model_trainer.py`):**
   - Implements a `RandomForestClassifier(random_state=42, class_weight='balanced')`.
   - Generates evaluation reports (Accuracy, Precision, Recall, F1, Confusion Matrix).
   - Extracts and sorts feature importances.
3. **Model Persistence:**
   - Saves the trained model and the preprocessor pipeline to the `models/` directory using `joblib`.
4. **Prediction Service (`prediction_service.py`):**
   - Provides an isolated `ManganEXPredictor` class.
   - Handles safe loading of the saved `.joblib` files.
   - Validates input schemas and gracefully catches missing fields before prediction.

## 5. Artifacts and Storage
All trained ML artifacts are saved in the `models/` directory:
- `rf_model.joblib`: The trained Random Forest model.
- `preprocessor.joblib`: The fitted column transformer (scaler/encoder).
- `evaluation_report.json`: Model metrics and dataset limitations.
- `feature_importance.json`: Ranked feature importances.
- `model_metadata.json`: Training timestamps, input schemas, and feature mappings.

## 6. Steps Needed Before Real-World Geological Deployment
Before this model can be deemed scientifically accurate:
1. Complete **Phase 6** to ingest verified geological datasets (e.g., remote sensing, geochemistry, actual prospectivity labels).
2. Establish robust Spatial Cross-Validation (standard K-Fold often fails in spatial datasets due to autocorrelation).
3. Tune hyperparameters based on real distribution metrics.
4. Replace median imputation with rigorous spatial interpolation methods.
