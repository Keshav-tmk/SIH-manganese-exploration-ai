# Phase 4 Feature Engineering

This document details the feature engineering pipeline developed for ManganEX. This pipeline takes processed geographical, terrain, and geological data and transforms it into machine-learning-ready features (`X`) and targets (`y`), ensuring standard scaling and zero data leakage.

## Feature Schema

### 1. Input Features
- `latitude` (Float): Physical location coordinates.
- `longitude` (Float): Physical location coordinates.
- `elevation` (Float): Height above sea level in meters.
- `slope` (Float): Terrain steepness in degrees.
- `vegetation_index` (Float): Measured vegetation health/density.
- `geological_feature` (Categorical String): Dominant rock/lithological type.

### 2. Derived Features
Currently, the pipeline scales numerical features using standard normalisation (`scikit-learn`'s `StandardScaler`):
- `elevation_scaled` (Float): Standardized elevation (mean=0, std=1).
- `slope_scaled` (Float): Standardized slope (mean=0, std=1).

**Target Warning:** No arbitrary coordinate-based derived features (e.g., lat*long) are generated as they lack scientific merit and lead to spatial overfitting.

### 3. Target Labels
Target variables are strictly isolated into a separate `y` dataset.
- `mineral_occurrence` (Categorical String): Presence/Absence/Type of minerals (e.g., Manganese, Iron).
- `prospectivity_label` (Categorical String): Pre-classified potential (High, Medium, Low).

### 4. Metadata
- `is_sample` (Boolean): A flag denoting that the data points are for demonstration/testing purposes and should not be used to train an active scientific model.

## Missing Value Handling
If required input features (`latitude`, `longitude`) are missing, the record is structurally flawed and **dropped**.
For missing optional features (e.g., `elevation`, `vegetation_index`), missing values are temporarily filled using the **median** of the column to ensure the dataset remains usable for pipeline testing. In future phases, scientifically justified imputation (e.g. spatial interpolation) will be introduced.

## Data Leakage Prevention
To prevent target leakage:
1. Target variables (`mineral_occurrence`, `prospectivity_label`) are removed from the feature matrix `X` before any transformations.
2. They are saved in an entirely distinct file (`labels_y.csv`).
3. The feature schema explicitly prevents the inclusion of derived target aggregates.

## Satellite Feature Preparation Framework
When real satellite data (e.g., Sentinel-2) is integrated, the pipeline will expand to calculate:
- **NDVI (Normalized Difference Vegetation Index):** Formula: `(NIR - Red) / (NIR + Red)`. Useful for identifying vegetation anomalies related to mineral deposits.
- **Band Ratios:** Specific ratios (e.g., SWIR bands 11 and 12) for highlighting geological variations.
- **Surface Reflectance:** Calibrated reflection metrics.
*Note: These features are currently NOT calculated because real satellite imagery has not been downloaded yet. No fake spectral data is generated.*

## ML Readiness & Limitations
The current datasets (`features_X.csv`, `labels_y.csv`) are correctly formatted for `scikit-learn` algorithms (Phase 5).
**CRITICAL LIMITATION:** The dataset consists of sample/demonstration values. Training a model on this data evaluates pipeline mechanics, but **does not** establish real-world geological prospectivity performance.

## Commands to Run the Pipeline
Ensure the virtual environment is activated in the `backend/` folder:
```powershell
python app/data_pipeline/feature_engineering.py
```
This generates:
- `data/features/features_X.csv`
- `data/features/labels_y.csv`
- `data/features/feature_quality_report.json`
