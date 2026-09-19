import pandas as pd
from typing import Dict, Any

class GeologicalDataProcessor:
    """
    Prepares geological vector and tabular data for feature engineering.
    Handles standardization of categorical geological attributes.
    """
    
    # Mapping of common geological terms to standardized categories
    LITHOLOGY_MAP = {
        'basalt': 'Basalt',
        'limestone': 'Limestone',
        'sandstone': 'Sandstone',
        'shale': 'Shale',
        'granite': 'Granite',
        'quartzite': 'Quartzite',
        'schist': 'Schist'
    }

    @staticmethod
    def standardize_lithology(raw_lithology: str) -> str:
        """Standardizes a lithology string to a known category."""
        if not isinstance(raw_lithology, str):
            return "Unknown"
        
        raw_lower = raw_lithology.lower().strip()
        for key, std_name in GeologicalDataProcessor.LITHOLOGY_MAP.items():
            if key in raw_lower:
                return std_name
                
        return "Unknown"

    @staticmethod
    def process_mineral_occurrences(occurrences_df: pd.DataFrame) -> pd.DataFrame:
        """
        Processes a raw occurrences dataset (like MRDS) into a standard format.
        Expected columns: latitude, longitude, commodity, status
        """
        if occurrences_df.empty:
            return pd.DataFrame(columns=["latitude", "longitude", "mineral_occurrence"])
            
        required = ["latitude", "longitude", "commodity"]
        missing = [c for c in required if c not in occurrences_df.columns]
        if missing:
            raise ValueError(f"Missing required columns for occurrences: {missing}")
            
        # Standardize commodity to boolean manganese presence
        occurrences_df["commodity_clean"] = occurrences_df["commodity"].astype(str).str.lower()
        occurrences_df["mineral_occurrence"] = occurrences_df["commodity_clean"].str.contains('manganese|mn').astype(int)
        
        return occurrences_df[["latitude", "longitude", "mineral_occurrence"]]

if __name__ == "__main__":
    print(GeologicalDataProcessor.standardize_lithology("weathered Basaltic rock"))
