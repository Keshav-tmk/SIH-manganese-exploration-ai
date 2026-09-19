import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
import json
import os

def prepare_dataset(features_path: str, labels_path: str):
    """
    Loads features and labels, handles missing values safely, applies encoding to categorical features,
    and splits the dataset into training and testing sets.
    """
    if not os.path.exists(features_path):
        raise FileNotFoundError(f"Features file missing at {features_path}")
    if not os.path.exists(labels_path):
        raise FileNotFoundError(f"Labels file missing at {labels_path}")

    X_raw = pd.read_csv(features_path)
    y_raw = pd.read_csv(labels_path)

    # 1. Feature Selection
    # Extract coordinates for spatial cross-validation
    coords = X_raw[['latitude', 'longitude']].copy() if 'latitude' in X_raw.columns else pd.DataFrame()
    
    # Exclude non-predictive features and spatial coordinates to prevent leakage
    exclude_cols = ['is_sample', 'latitude', 'longitude']
    X = X_raw.drop(columns=[col for col in exclude_cols if col in X_raw.columns])

    # 2. Target Selection
    if 'prospectivity_label' not in y_raw.columns:
        raise ValueError("Missing primary target label: 'prospectivity_label'")
    y = y_raw['prospectivity_label']

    # 3. Data Cleanup
    # Ensure no missing values in target
    valid_idx = y.notna()
    X = X[valid_idx]
    y = y[valid_idx]
    if not coords.empty:
        coords = coords[valid_idx]
    
    if len(X) == 0:
        raise ValueError("No valid records remain after dropping missing targets.")

    # 4. Preprocessing Pipeline Definition
    categorical_features = []
    # Scale all numeric features
    numeric_to_scale = ['elevation', 'slope', 'NDVI', 'B2', 'B3', 'B4', 'B8', 'B11', 'B12']
    numeric_features = [col for col in X.columns if col not in categorical_features]

    # Preprocessor using ColumnTransformer
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), [c for c in numeric_to_scale if c in X.columns])
        ],
        remainder='passthrough'
    )

    # 5. Fit Preprocessor on the entire dataset
    # We defer train/test splitting to model_trainer.py for spatial cross-validation
    X_processed = preprocessor.fit_transform(X)
    
    # Get feature names after encoding
    scaled_features = [c for c in numeric_to_scale if c in X.columns]
    remainder_features = [c for c in X.columns if c not in scaled_features]
    feature_names = scaled_features + remainder_features

    class_counts = y.value_counts()
    
    report = {
        "original_rows": len(X_raw),
        "valid_rows": len(X),
        "features_used": list(X.columns),
        "numeric_kept": numeric_features,
        "classes_found": y.unique().tolist(),
        "class_distribution": class_counts.to_dict()
    }

    return X_processed, y, coords, preprocessor, feature_names, report
