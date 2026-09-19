import os
import requests
import json
from pathlib import Path
from typing import Dict, Any, Optional

class DataAcquisitionManager:
    """
    Manager for acquiring real-world geospatial and geological datasets.
    Provides interfaces to download data from public APIs or instructions for manual downloads.
    """
    
    def __init__(self, data_root: str):
        self.data_root = Path(data_root)
        self.raw_dir = self.data_root / "raw"
        self.metadata_dir = self.data_root / "metadata"
        
        # Ensure directories exist
        for subdir in ["satellite", "geological", "terrain", "occurrences"]:
            (self.raw_dir / subdir).mkdir(parents=True, exist_ok=True)
        self.metadata_dir.mkdir(parents=True, exist_ok=True)

    def _save_metadata(self, source_name: str, metadata: Dict[str, Any]):
        """Save metadata about an acquired dataset."""
        metadata_path = self.metadata_dir / f"{source_name}_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=4)
        print(f"Metadata saved to {metadata_path}")

    def download_mrds_sample(self, output_filename: str = "mrds_sample.csv") -> Optional[Path]:
        """
        Attempts to download a sample subset of USGS MRDS data if accessible.
        Otherwise, provides manual instructions.
        """
        url = "https://mrdata.usgs.gov/mrds/mrds-csv.zip"
        output_path = self.raw_dir / "occurrences" / output_filename
        
        print(f"--- USGS MRDS Data Acquisition ---")
        print(f"Dataset is large. For production, please download manually from: {url}")
        print(f"Place the extracted CSV file at: {output_path}")
        
        # Save placeholder metadata
        metadata = {
            "source": "USGS MRDS",
            "url": url,
            "type": "Mineral Occurrences",
            "status": "Pending Manual Download"
        }
        self._save_metadata("usgs_mrds", metadata)
        return output_path

    def download_srtm_tile(self, lat: float, lon: float) -> Optional[Path]:
        """
        Framework for downloading an SRTM elevation tile.
        Requires Earthdata API credentials.
        """
        print(f"--- SRTM Elevation Data Acquisition ---")
        print("Earthdata API requires authentication.")
        print(f"To acquire elevation data for ({lat}, {lon}), please visit:")
        print("https://search.earthdata.nasa.gov/search?q=SRTMGL1")
        print(f"Place the downloaded .hgt or .tif file in: {self.raw_dir / 'terrain'}")
        
        metadata = {
            "source": "NASA SRTM V3",
            "required_lat": lat,
            "required_lon": lon,
            "status": "Pending Manual Download (Auth Required)"
        }
        self._save_metadata("srtm_elevation", metadata)
        return None

    def download_sentinel2_imagery(self, bbox: tuple) -> Optional[Path]:
        """
        Framework for downloading Sentinel-2 imagery via Copernicus Data Space.
        Requires OAuth2 credentials.
        """
        print(f"--- Sentinel-2 Imagery Acquisition ---")
        print("Copernicus Data Space Ecosystem requires authentication.")
        print(f"To acquire imagery for bbox {bbox}, please use the Copernicus Browser:")
        print("https://browser.dataspace.copernicus.eu/")
        print(f"Place the downloaded L2A SAFE folder or GeoTIFFs in: {self.raw_dir / 'satellite'}")
        
        metadata = {
            "source": "Copernicus Sentinel-2",
            "bbox": bbox,
            "status": "Pending Manual Download (Auth Required)"
        }
        self._save_metadata("sentinel_2", metadata)
        return None

    def download_karnataka_pilot_data(self):
        """
        Provides instructions and bounding box constraints for the Sandur-Ballari
        manganese belt in Karnataka, India.
        Bounding box: Lat 14.85 to 15.27, Lon 76.45 to 76.75
        """
        bbox = (76.45, 14.85, 76.75, 15.27)
        print("\n=== Karnataka Pilot Region: Sandur-Ballari ===")
        print(f"Target Bounding Box (Lon_Min, Lat_Min, Lon_Max, Lat_Max): {bbox}")
        print("\n1. Geological Data (GSI / NGDR):")
        print("   - Visit: https://geoscience-data.gov.in/ or https://bhukosh.gsi.gov.in/")
        print("   - Search for 'Manganese' in Karnataka state, Bellary district.")
        print(f"   - Place shapefiles in: {self.raw_dir / 'geological'}")
        print("\n2. Terrain Data (ISRO Bhuvan / SRTM):")
        print("   - Download DEM covering the bounding box.")
        print(f"   - Place DEM GeoTIFF in: {self.raw_dir / 'terrain'}")
        print("\n3. Satellite Imagery (Bhuvan / Sentinel-2):")
        print(f"   - Place Multispectral imagery in: {self.raw_dir / 'satellite'}")
        
        metadata = {
            "region": "Sandur-Ballari, Karnataka, India",
            "bbox": bbox,
            "required_layers": ["geology_shapefiles", "elevation_dem", "satellite_multispectral"],
            "status": "Pending Data Ingestion"
        }
        self._save_metadata("karnataka_pilot", metadata)

    def download_multi_region_data(self):
        """
        Phase 15: Provides acquisition instructions and metadata for all six
        major Indian manganese mineral belts used in multi-region training.

        Regions covered:
          1. Sandur-Ballari, Karnataka       (existing pilot)
          2. Nagpur-Bhandara, Maharashtra
          3. Balaghat, Madhya Pradesh
          4. Sundergarh, Odisha
          5. North Goa, Goa
          6. Vizianagaram, Andhra Pradesh

        Each region entry records its bounding box and recommended data sources
        for future real-data integration.
        """
        regions = [
            {
                "key": "sandur_ballari",
                "name": "Sandur-Ballari, Karnataka",
                "bbox": (76.45, 14.85, 76.75, 15.27),
                "sources": ["GSI Bhukosh", "ISRO Bhuvan DEM", "Copernicus Sentinel-2"],
                "note": "Primary pilot region — real Sentinel-2 data already partially acquired."
            },
            {
                "key": "nagpur_bhandara",
                "name": "Nagpur-Bhandara, Maharashtra",
                "bbox": (79.55, 20.85, 80.10, 21.45),
                "sources": ["NGDR Portal", "SRTM Tiles", "Sentinel-2 L2A"],
                "note": "Gondite-type deposits; key Maharashtra manganese production zone."
            },
            {
                "key": "balaghat",
                "name": "Balaghat, Madhya Pradesh",
                "bbox": (80.25, 21.75, 80.75, 22.30),
                "sources": ["GSI District Reports", "SRTM", "Landsat-8 OLI"],
                "note": "Second-largest Mn belt in MP; accessible via Bhuvan."
            },
            {
                "key": "sundergarh",
                "name": "Sundergarh, Odisha",
                "bbox": (84.05, 22.00, 84.55, 22.55),
                "sources": ["Odisha Mining Corporation GIS", "SRTM", "Sentinel-2"],
                "note": "Lateritized Mn; Odisha is India's top Mn-producing state."
            },
            {
                "key": "north_goa",
                "name": "North Goa, Goa",
                "bbox": (73.85, 15.45, 74.25, 15.80),
                "sources": ["Goa Mineral Survey Dept.", "Bhuvan DEM", "Sentinel-2"],
                "note": "Laterite-capped Mn. Smaller belt but geologically distinct."
            },
            {
                "key": "vizianagaram",
                "name": "Vizianagaram, Andhra Pradesh",
                "bbox": (83.35, 18.40, 83.85, 18.90),
                "sources": ["APMDP Reports", "SRTM", "Sentinel-2 L2A"],
                "note": "Metamorphic Mn in Eastern Ghats Mobile Belt khondalites."
            },
        ]

        print("\n=== Phase 15: Multi-Region Data Acquisition Framework ===")
        all_metadata = {}

        for region in regions:
            print(f"\n--- {region['name']} ---")
            print(f"  Bounding Box (Lon_Min, Lat_Min, Lon_Max, Lat_Max): {region['bbox']}")
            print("  Recommended Data Sources:")
            for src in region["sources"]:
                print(f"    • {src}")
            print(f"  Note: {region['note']}")
            print(f"  Place data in: {self.raw_dir / region['key']}")
            (self.raw_dir / region["key"]).mkdir(parents=True, exist_ok=True)

            all_metadata[region["key"]] = {
                "name": region["name"],
                "bbox_lon_min_lat_min_lon_max_lat_max": list(region["bbox"]),
                "sources": region["sources"],
                "note": region["note"],
                "status": "Pending Data Ingestion",
            }

        combined_metadata = {
            "phase": "Phase 15 – Multi-Region Training",
            "regions": all_metadata,
            "instructions": (
                "Download satellite imagery, DEMs, and geological shapefiles for each region. "
                "Place data in the corresponding subdirectory under data/raw/. "
                "Run generate_training_data.py per region once real data is available."
            )
        }
        self._save_metadata("multi_region_acquisition", combined_metadata)
        print(f"\nMulti-region acquisition metadata saved to {self.metadata_dir}")

if __name__ == "__main__":
    # Test the acquisition framework
    import sys
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    data_dir = os.path.join(base_dir, "data")
    
    manager = DataAcquisitionManager(data_dir)
    manager.download_karnataka_pilot_data()
