import pandas as pd
import os

def clean_dataset(input_path: str, output_path: str):
    """
    Cleans a dataset for ManganEX data pipeline.
    - Loads data
    - Removes exact duplicates
    - Validates coordinate ranges (removes invalid rows)
    - Safely converts numeric columns
    - Handles missing values (simple fill/drop based on logic)
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")
        
    print(f"Loading data from {input_path}...")
    df = pd.read_csv(input_path)
    initial_count = len(df)
    
    # 1. Remove duplicates
    duplicates = df.duplicated().sum()
    if duplicates > 0:
        df = df.drop_duplicates()
        print(f"Removed {duplicates} duplicate rows.")

    # 2. Safely convert coordinates and filter invalid ranges
    if "latitude" in df.columns:
        df["latitude"] = pd.to_numeric(df["latitude"], errors='coerce')
        valid_lat = (df["latitude"] >= -90) & (df["latitude"] <= 90)
        invalid_lat_count = (~valid_lat).sum()
        if invalid_lat_count > 0:
            df = df[valid_lat]
            print(f"Removed {invalid_lat_count} rows with invalid latitude.")

    if "longitude" in df.columns:
        df["longitude"] = pd.to_numeric(df["longitude"], errors='coerce')
        valid_lon = (df["longitude"] >= -180) & (df["longitude"] <= 180)
        invalid_lon_count = (~valid_lon).sum()
        if invalid_lon_count > 0:
            df = df[valid_lon]
            print(f"Removed {invalid_lon_count} rows with invalid longitude.")
            
    # 3. Handle missing values 
    # For a real pipeline, imputation strategies should be statistically justified.
    # Here, we drop rows missing critical coordinates, and fill others with unknown/mean.
    if "latitude" in df.columns and "longitude" in df.columns:
        missing_coords = df["latitude"].isna() | df["longitude"].isna()
        if missing_coords.sum() > 0:
            df = df[~missing_coords]
            print(f"Removed {missing_coords.sum()} rows missing coordinate data.")

    # Convert numeric columns to numeric (coercing errors to NaN)
    numeric_columns = ["elevation", "slope", "vegetation_index"]
    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    final_count = len(df)
    
    # Save processed data
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"Data cleaning complete. Saved to {output_path}.")
    print(f"Summary: Initial rows={initial_count}, Final rows={final_count}, Removed={initial_count - final_count}")

    return {
        "initial_count": initial_count,
        "final_count": final_count,
        "removed": initial_count - final_count,
        "output_path": output_path
    }

if __name__ == "__main__":
    import sys
    
    input_path = sys.argv[1] if len(sys.argv) > 1 else "../../data/sample/manganex_sample_data.csv"
    output_path = sys.argv[2] if len(sys.argv) > 2 else "../../data/processed/manganex_sample_data_cleaned.csv"
    
    clean_dataset(input_path, output_path)
