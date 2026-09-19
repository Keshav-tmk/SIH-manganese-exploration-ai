import pandas as pd
from typing import Optional

class SpatialAligner:
    """
    Handles the spatial alignment of disparate datasets (Satellite, Terrain, Geological).
    Acts as a framework to join features based on spatial coordinates.
    """
    
    @staticmethod
    def align_features_by_coordinate(
        base_df: pd.DataFrame, 
        satellite_df: Optional[pd.DataFrame] = None,
        terrain_df: Optional[pd.DataFrame] = None,
        geological_df: Optional[pd.DataFrame] = None,
        tolerance: float = 0.001
    ) -> pd.DataFrame:
        """
        Aligns feature datasets based on latitude and longitude within a given tolerance.
        In a production environment, this would use spatial joins (e.g., geopandas.sjoin).
        For now, this performs a structural merge based on exact or rounded coordinates.
        """
        aligned_df = base_df.copy()
        
        # Standardize coordinate precision for merging
        aligned_df['lat_round'] = aligned_df['latitude'].round(3)
        aligned_df['lon_round'] = aligned_df['longitude'].round(3)
        
        if satellite_df is not None and not satellite_df.empty:
            sat = satellite_df.copy()
            sat['lat_round'] = sat['latitude'].round(3)
            sat['lon_round'] = sat['longitude'].round(3)
            sat = sat.drop(columns=['latitude', 'longitude'])
            aligned_df = pd.merge(aligned_df, sat, on=['lat_round', 'lon_round'], how='left')
            
        if terrain_df is not None and not terrain_df.empty:
            ter = terrain_df.copy()
            ter['lat_round'] = ter['latitude'].round(3)
            ter['lon_round'] = ter['longitude'].round(3)
            ter = ter.drop(columns=['latitude', 'longitude'])
            aligned_df = pd.merge(aligned_df, ter, on=['lat_round', 'lon_round'], how='left')
            
        if geological_df is not None and not geological_df.empty:
            geo = geological_df.copy()
            geo['lat_round'] = geo['latitude'].round(3)
            geo['lon_round'] = geo['longitude'].round(3)
            geo = geo.drop(columns=['latitude', 'longitude'])
            aligned_df = pd.merge(aligned_df, geo, on=['lat_round', 'lon_round'], how='left')
            
        aligned_df = aligned_df.drop(columns=['lat_round', 'lon_round'])
        return aligned_df

if __name__ == "__main__":
    base = pd.DataFrame({"latitude": [21.123], "longitude": [79.456]})
    sat = pd.DataFrame({"latitude": [21.123], "longitude": [79.456], "vegetation_index": [0.65]})
    
    aligned = SpatialAligner.align_features_by_coordinate(base, sat)
    print("Alignment test:\n", aligned)
