# Phase 9: Geospatial Processing Pipeline

## Overview

The Geospatial Processing Pipeline provides the foundational capabilities for ingesting, validating, and transforming spatial data files (`.shp`, `.geojson`, `.gpkg`, `.tif`) in the ManganEX platform.

Due to the common challenges of installing GDAL C-extensions on Windows environments (which `fiona`, `rasterio`, and `geopandas` rely on), this pipeline features a **robust simulated fallback mechanism**. This ensures the backend server doesn't crash during deployment or development on constrained environments, while preserving the API surface for future integration.

## Key Components

1. **`backend/app/data_pipeline/geospatial.py`**
   - **`is_geospatial_env_ready()`**: Checks for the presence of GDAL-dependent libraries (`geopandas`, `rasterio`, etc.).
   - **`process_vector_data(file_path)`**: Validates vector files. If GeoPandas is available, it checks CRS (reprojecting to EPSG:4326), drops invalid geometries, and checks intersection with the Sandur-Ballari pilot region bounding box. If missing, it provides simulated processing results.
   - **`process_raster_data(file_path)`**: Validates raster files. If Rasterio is available, it reads metadata, validates CRS, and computes spatial bounds. Otherwise, simulates the output.
   - **`PILOT_BBOX`**: Defines the geographical bounding box for the initial pilot region (Sandur-Ballari, Karnataka: `[76.5, 14.9, 76.6, 15.1]`).

2. **`backend/app/data_pipeline/validate.py`**
   - Integrates the geospatial module functions into the main validation script, ensuring that uploaded/scanned data files trigger spatial validation if they match geospatial extensions.

3. **`backend/app/main.py`**
   - **`GET /api/geospatial/status`**: Returns the health status of the geospatial engine.
   - **`GET /api/geospatial/pilot-region`**: Returns the bounding box coordinates and metadata for the current target region.
   - **`POST /api/geospatial/validate`**: Endpoint to trigger validation of a specific local file in the `data` directory.

4. **Frontend Integration**
   - The React frontend fetches and displays the Geospatial Engine status in the header alongside the Backend and Model statuses.
   - The `MapComponent` uses `react-leaflet`'s `<Rectangle />` component to draw the pilot region bounding box on the map.

## Setup & Dependencies

To enable native processing (non-simulated), the following packages must be installed in a Python environment containing compiled GDAL libraries (e.g., via `conda install gdal` or pre-compiled wheels from Christoph Gohlke's repository):

```text
geopandas==1.0.1
rasterio==1.3.10
shapely==2.0.6
fiona==1.9.6
pyproj==3.6.1
```

If these are not present, the `geospatial.py` module handles the `ImportError` gracefully and operates in fallback mode.
