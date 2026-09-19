import pandas as pd
import json
import numpy as np
import os

def haversine(lat1, lon1, lat2, lon2):
    # Radius of earth in kilometers
    R = 6371.0
    
    phi1 = np.radians(lat1)
    phi2 = np.radians(lat2)
    delta_phi = np.radians(lat2 - lat1)
    delta_lambda = np.radians(lon2 - lon1)
    
    a = np.sin(delta_phi / 2.0)**2 + np.cos(phi1) * np.cos(phi2) * np.sin(delta_lambda / 2.0)**2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    
    return R * c

def generate_data():
    # __file__ is in backend/app/ml/
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    data_dir = os.path.join(base_dir, "data")
    
    sat_file = os.path.join(data_dir, "Manganese_Exploration_MultiSeason_Features.csv")
    dep_file = os.path.join(data_dir, "Manganese_Ore_deposits_in_India_and_its_salient_features.csv")
    
    print(f"Loading satellite features from {sat_file}")
    df_sat = pd.read_csv(sat_file)
    print(f"Loading deposit references from {dep_file}")
    df_dep = pd.read_csv(dep_file)
    
    # Extract coordinates from .geo JSON string
    def extract_coords(geo_str):
        try:
            geo = json.loads(geo_str)
            if geo['type'] == 'Point':
                return geo['coordinates'][1], geo['coordinates'][0] # lat, lon
        except Exception:
            pass
        return None, None

    coords = df_sat['.geo'].apply(extract_coords).tolist()
    df_sat[['latitude', 'longitude']] = pd.DataFrame(coords, index=df_sat.index)
    
    # Drop rows without valid coordinates
    df_sat = df_sat.dropna(subset=['latitude', 'longitude'])
    
    labels = []
    
    for idx, row in df_sat.iterrows():
        lat = row['latitude']
        lon = row['longitude']
        
        # Calculate distance to all known deposits
        distances = haversine(
            lat, lon, 
            pd.to_numeric(df_dep['latdd'], errors='coerce').values, 
            pd.to_numeric(df_dep['londd'], errors='coerce').values
        )
        # Ignore NaNs
        distances = distances[~np.isnan(distances)]
        min_dist = np.min(distances) if len(distances) > 0 else float('inf')
        
        if min_dist <= 5.0:
            labels.append("High")
        elif min_dist <= 15.0:
            labels.append("Medium")
        else:
            labels.append("Low")
            
    df_sat['prospectivity_label'] = labels
    
    # Keep only relevant features
    features_to_keep = [
        'latitude', 'longitude', 'elevation', 'slope', 'NDVI',
        'B2', 'B3', 'B4', 'B8', 'B11', 'B12'
    ]
    
    df_features = df_sat[features_to_keep].copy()
    df_labels = df_sat[['prospectivity_label']].copy()
    
    out_feat = os.path.join(data_dir, "features", "features_X_real.csv")
    out_lbl = os.path.join(data_dir, "features", "labels_y_real.csv")
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(out_feat), exist_ok=True)
    
    df_features.to_csv(out_feat, index=False)
    df_labels.to_csv(out_lbl, index=False)
    
    print(f"Successfully generated {len(df_features)} training samples.")
    print("Label distribution:")
    print(df_labels['prospectivity_label'].value_counts())
    print(f"Features saved to: {out_feat}")
    print(f"Labels saved to: {out_lbl}")

if __name__ == "__main__":
    generate_data()
