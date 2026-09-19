import pandas as pd
import os
import json
from sklearn.preprocessing import StandardScaler

def engineer_features(input_path: str, output_features_path: str, output_labels_path: str, report_path: str):
    """
    Feature engineering pipeline for ManganEX.
    Loads processed data, creates derived features safely, handles missing values,
    separates features (X) and targets (y), and generates a quality report.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Processed input file not found: {input_path}")
    
    print(f"Loading cleaned dataset from {input_path}...")
    df = pd.read_csv(input_path)
    
    # Try importing SpatialAligner for Phase 8 data merging
    try:
        from .alignment import SpatialAligner
        # In a full pipeline, we would load satellite/terrain data here and merge.
        # df = SpatialAligner.align_features_by_coordinate(df, satellite_df, terrain_df, geological_df)
    except ImportError:
        pass
    
    # 1. Feature Classification & Setup
    target_columns = ["mineral_occurrence", "prospectivity_label"]
    metadata_columns = ["is_sample"]
    
    # Check for text in numeric columns
    numeric_features = ["latitude", "longitude", "elevation", "slope", "vegetation_index"]
    for col in numeric_features:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Drop rows where required base features are missing
    required_features = ["latitude", "longitude"]
    df = df.dropna(subset=[col for col in required_features if col in df.columns])
    
    if df.empty:
        raise ValueError("Dataset is empty after dropping missing required features.")
    
    # 2. Transformations and Derived Features
    # Fill missing values for optional numerics with median or 0, depending on context
    # In a real model, this would use a fitted imputer.
    if "elevation" in df.columns:
        df["elevation"] = df["elevation"].fillna(df["elevation"].median())
    if "slope" in df.columns:
        df["slope"] = df["slope"].fillna(0)
    if "vegetation_index" in df.columns:
        df["vegetation_index"] = df["vegetation_index"].fillna(df["vegetation_index"].median())

    # Create scaled features for terrain (standardization)
    scaler = StandardScaler()
    scale_cols = [c for c in ["elevation", "slope"] if c in df.columns]
    if scale_cols:
        scaled_values = scaler.fit_transform(df[scale_cols])
        for i, col in enumerate(scale_cols):
            df[f"{col}_scaled"] = scaled_values[:, i]
            
    # Add metadata flag
    df["is_sample"] = True
    
    # 3. Prevent Data Leakage
    # Separate targets (y) from features (X)
    available_targets = [col for col in target_columns if col in df.columns]
    y = df[available_targets].copy() if available_targets else pd.DataFrame()
    
    X = df.drop(columns=available_targets)
    
    # 4. Generate Feature Quality Report
    report = {
        "total_records": len(df),
        "features": list(X.columns),
        "target_labels": list(y.columns),
        "data_types": {col: str(X[col].dtype) for col in X.columns},
        "missing_values": X.isna().sum().to_dict(),
        "numeric_stats": {}
    }
    
    for col in X.select_dtypes(include=['float64', 'int64']).columns:
        if not X[col].empty:
            report["numeric_stats"][col] = {
                "min": float(X[col].min()),
                "max": float(X[col].max()),
                "mean": float(X[col].mean()),
                "std": float(X[col].std())
            }
            
    report["is_sample_data"] = True
    report["suitability_for_phase_5"] = "Ready for structural pipeline testing, but NOT suitable for scientific model training."

    # 5. Save outputs
    os.makedirs(os.path.dirname(output_features_path), exist_ok=True)
    X.to_csv(output_features_path, index=False)
    y.to_csv(output_labels_path, index=False)
    
    if report_path:
        with open(report_path, "w") as f:
            json.dump(report, f, indent=4)
            
    print(f"Feature engineering complete. ML-ready features saved to {output_features_path}.")
    print(f"Target labels saved to {output_labels_path}.")
    print(f"Feature quality report generated at {report_path}.")

if __name__ == "__main__":
    import sys
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    input_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(base_dir, "../data/processed/manganex_sample_data_cleaned.csv")
    out_x = sys.argv[2] if len(sys.argv) > 2 else os.path.join(base_dir, "../data/features/features_X.csv")
    out_y = sys.argv[3] if len(sys.argv) > 3 else os.path.join(base_dir, "../data/features/labels_y.csv")
    out_report = sys.argv[4] if len(sys.argv) > 4 else os.path.join(base_dir, "../data/features/feature_quality_report.json")
    
    engineer_features(input_path, out_x, out_y, out_report)
