import unittest
import pandas as pd
import numpy as np
import os
import sys

# Ensure correct path
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from data_pipeline.satellite_prep import SatelliteDataProcessor
from data_pipeline.geological_prep import GeologicalDataProcessor
from data_pipeline.terrain_prep import TerrainDataProcessor
from data_pipeline.alignment import SpatialAligner

class TestRealDataPipeline(unittest.TestCase):
    
    def test_satellite_ndvi(self):
        nir = np.array([0.8, 0.6])
        red = np.array([0.2, 0.2])
        ndvi = SatelliteDataProcessor.calculate_ndvi(nir, red)
        self.assertAlmostEqual(ndvi[0], 0.6)
        self.assertAlmostEqual(ndvi[1], 0.5)

    def test_geological_standardization(self):
        self.assertEqual(GeologicalDataProcessor.standardize_lithology("WEATHERED BASALT"), "Basalt")
        self.assertEqual(GeologicalDataProcessor.standardize_lithology("Some unknown rock"), "Unknown")
        
    def test_mineral_occurrence_processing(self):
        df = pd.DataFrame({
            "latitude": [10.0, 11.0],
            "longitude": [20.0, 21.0],
            "commodity": ["Manganese", "Iron"],
            "status": ["Past Producer", "Occurrence"]
        })
        processed = GeologicalDataProcessor.process_mineral_occurrences(df)
        self.assertEqual(processed["mineral_occurrence"].iloc[0], 1)
        self.assertEqual(processed["mineral_occurrence"].iloc[1], 0)

    def test_spatial_alignment(self):
        base = pd.DataFrame({
            "latitude": [21.1234, 21.5678],
            "longitude": [79.4567, 79.8765]
        })
        
        sat = pd.DataFrame({
            "latitude": [21.1231, 21.5679], # Slightly off, will match at 3 decimals
            "longitude": [79.4568, 79.8761],
            "ndvi": [0.5, 0.6]
        })
        
        aligned = SpatialAligner.align_features_by_coordinate(base, satellite_df=sat)
        self.assertEqual(len(aligned), 2)
        self.assertIn("ndvi", aligned.columns)
        self.assertEqual(aligned["ndvi"].iloc[0], 0.5)
        self.assertEqual(aligned["ndvi"].iloc[1], 0.6)

    def test_pilot_bbox_validation(self):
        from data_pipeline.validate import _check_pilot_bbox
        
        # Inside Sandur-Ballari
        # Lon 76.45 to 76.75, Lat 14.85 to 15.27
        inside_bounds = [76.5, 14.9, 76.6, 15.1]
        self.assertTrue(_check_pilot_bbox(inside_bounds))
        
        # Outside (e.g. Nagpur)
        outside_bounds = [78.5, 20.5, 79.5, 21.5]
        self.assertFalse(_check_pilot_bbox(outside_bounds))

if __name__ == "__main__":
    unittest.main()
