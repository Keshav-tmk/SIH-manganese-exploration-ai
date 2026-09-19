import pandas as pd
import os

def validate_dataset(file_path: str):
    """
    Validates a dataset for ManganEX data pipeline.
    Checks: required columns, missing values, duplicates, invalid coordinates.
    """
    report = {
        "file_path": file_path,
        "is_valid": True,
        "errors": [],
        "warnings": [],
        "total_records": 0,
        "valid_records": 0,
        "invalid_records": 0,
        "columns": [],
    }

    if not os.path.exists(file_path):
        report["is_valid"] = False
        report["errors"].append(f"File not found: {file_path}")
        return report

    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        report["is_valid"] = False
        report["errors"].append(f"Failed to read CSV: {str(e)}")
        return report

    if df.empty:
        report["is_valid"] = False
        report["errors"].append("Dataset is empty.")
        return report

    report["total_records"] = len(df)
    report["columns"] = list(df.columns)

    required_columns = {"latitude", "longitude"}
    missing_cols = required_columns - set(df.columns)
    if missing_cols:
        report["is_valid"] = False
        report["errors"].append(f"Missing required columns: {', '.join(missing_cols)}")
        return report

    # Duplicate check
    duplicates = df.duplicated().sum()
    if duplicates > 0:
        report["warnings"].append(f"Found {duplicates} duplicate rows.")

    invalid_indices = set()

    # Numeric conversion check for coordinates
    for col in ["latitude", "longitude"]:
        numeric_col = pd.to_numeric(df[col], errors='coerce')
        invalid_numeric = numeric_col.isna() & df[col].notna()
        if invalid_numeric.any():
            invalid_indices.update(df[invalid_numeric].index)
            report["errors"].append(f"Found non-numeric values in {col}.")
            report["is_valid"] = False

    # Coordinate range validation
    if "latitude" in df.columns:
        lat = pd.to_numeric(df["latitude"], errors='coerce')
        invalid_lat = (lat < -90) | (lat > 90)
        if invalid_lat.any():
            invalid_indices.update(df[invalid_lat].index)
            report["errors"].append(f"Found {invalid_lat.sum()} invalid latitude values (must be between -90 and 90).")

    if "longitude" in df.columns:
        lon = pd.to_numeric(df["longitude"], errors='coerce')
        invalid_lon = (lon < -180) | (lon > 180)
        if invalid_lon.any():
            invalid_indices.update(df[invalid_lon].index)
            report["errors"].append(f"Found {invalid_lon.sum()} invalid longitude values (must be between -180 and 180).")

    # Missing values check
    missing_counts = df.isna().sum()
    for col, count in missing_counts.items():
        if count > 0:
            report["warnings"].append(f"Column '{col}' has {count} missing values.")
            invalid_indices.update(df[df[col].isna()].index)

    report["invalid_records"] = len(invalid_indices)
    report["valid_records"] = report["total_records"] - report["invalid_records"]

    if report["errors"]:
        report["is_valid"] = False

    return report

def _check_pilot_bbox(bounds, is_raster=False):
    """
    Checks if the data falls near or within the Sandur-Ballari pilot region.
    Target Bounding Box: Lon 76.45 to 76.75, Lat 14.85 to 15.27
    """
    lon_min, lat_min, lon_max, lat_max = bounds
    target_lon_min, target_lat_min, target_lon_max, target_lat_max = 76.45, 14.85, 76.75, 15.27
    
    # Simple overlap check
    if lon_max < target_lon_min or lon_min > target_lon_max or lat_max < target_lat_min or lat_min > target_lat_max:
        return False
    return True

def validate_raster(file_path: str):
    """
    Validates a raster dataset (e.g., GeoTIFF) for ManganEX.
    Uses the robust geospatial pipeline if available.
    """
    from .geospatial import process_raster_data
    
    result = process_raster_data(file_path)
    
    report = {
        "file_path": file_path,
        "is_valid": result.get("status") == "success",
        "errors": [] if result.get("status") == "success" else [result.get("message")],
        "warnings": [],
        "type": "raster"
    }

    if report["is_valid"]:
        if result.get("fallback_mode"):
            report["warnings"].append(result["message"])
        if not result.get("pilot_overlap"):
            report["warnings"].append("Raster bounds do not intersect the Sandur-Ballari pilot region.")
        report.update(result)

    return report

def validate_vector(file_path: str):
    """
    Validates a vector dataset (e.g., GeoJSON, Shapefile) for ManganEX.
    Uses the robust geospatial pipeline if available.
    """
    from .geospatial import process_vector_data
    
    result = process_vector_data(file_path)
    
    report = {
        "file_path": file_path,
        "is_valid": result.get("status") == "success",
        "errors": [] if result.get("status") == "success" else [result.get("message")],
        "warnings": [],
        "type": "vector"
    }

    if report["is_valid"]:
        if result.get("fallback_mode"):
            report["warnings"].append(result["message"])
        if not result.get("pilot_overlap"):
            report["warnings"].append("Vector bounds do not intersect the Sandur-Ballari pilot region.")
        if result.get("invalid_geometries_dropped", 0) > 0:
            report["warnings"].append(f"Dropped {result['invalid_geometries_dropped']} invalid geometries.")
        report.update(result)

    return report

if __name__ == "__main__":
    import json
    import sys
    
    file_path = sys.argv[1] if len(sys.argv) > 1 else "../../data/sample/manganex_sample_data.csv"
    report = validate_dataset(file_path)
    print(json.dumps(report, indent=4))
