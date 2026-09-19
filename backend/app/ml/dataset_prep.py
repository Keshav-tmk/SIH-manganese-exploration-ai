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
    # Drop pure geographical coordinates and previously scaled features to prevent spatial overfitting and double scaling
    exclude_cols = ['latitude', 'longitude', 'elevation_scaled', 'slope_scaled', 'is_sample']
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
    
    if len(X) == 0:
        raise ValueError("No valid records remain after dropping missing targets.")

    # 4. Preprocessing Pipeline Definition
    categorical_features = ['geological_feature']
    # Scale elevation and slope
    numeric_to_scale = ['elevation', 'slope']
    # Keep others as pass through (e.g., vegetation_index)
    numeric_features = [col for col in X.columns if col not in categorical_features]

    # Preprocessor using ColumnTransformer
    preprocessor = ColumnTransformer(
        transformers=[
            ('cat', OneHotEncoder(handle_unknown='ignore'), [c for c in categorical_features if c in X.columns]),
            ('num', StandardScaler(), [c for c in numeric_to_scale if c in X.columns])
        ],
        remainder='passthrough'
    )

    # 5. Train-Test Split (with fallbacks for small/sample datasets)
    class_counts = y.value_counts()
    min_class_count = class_counts.min()

    if len(X) < 10 or min_class_count < 2:
        print("WARNING: Dataset is too small or classes are too imbalanced for stratified splitting. Falling back to random split.")
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    else:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # 6. Fit Preprocessor (only on training data to prevent leakage)
    X_train_processed = preprocessor.fit_transform(X_train)
    X_test_processed = preprocessor.transform(X_test)
    
    # Get feature names after encoding
    # Get categorical names
    cat_names = preprocessor.named_transformers_['cat'].get_feature_names_out(categorical_features)
    # Combine with remainder (numeric) names
    feature_names = list(cat_names) + numeric_features

    report = {
        "original_rows": len(X_raw),
        "valid_rows": len(X),
        "features_used": list(X.columns),
        "categorical_encoded": list(cat_names),
        "numeric_kept": numeric_features,
        "classes_found": y.unique().tolist(),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "class_distribution": class_counts.to_dict()
    }

    return X_train_processed, X_test_processed, y_train, y_test, preprocessor, feature_names, report
