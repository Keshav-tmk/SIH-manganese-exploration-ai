import os
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Sandur-Ballari (Bellary) target region Bounding Box
PILOT_BBOX = {
    "lon_min": 76.45,
    "lat_min": 14.85,
    "lon_max": 76.75,
    "lat_max": 15.27
}

def is_geospatial_env_ready() -> Dict[str, bool]:
    """Check if the geospatial libraries are successfully installed."""
    status = {"geopandas": False, "rasterio": False}
    try:
        import geopandas
        status["geopandas"] = True
    except ImportError:
        pass
    
    try:
        import rasterio
        status["rasterio"] = True
    except ImportError:
        pass
        
    return status

def _check_overlap(bounds: list) -> bool:
    """Check if provided bounds overlap with the Pilot Bounding Box."""
    lon_min, lat_min, lon_max, lat_max = bounds
    
    # Overlap logic
    if (lon_max < PILOT_BBOX["lon_min"] or lon_min > PILOT_BBOX["lon_max"] or
        lat_max < PILOT_BBOX["lat_min"] or lat_min > PILOT_BBOX["lat_max"]):
        return False
    return True

def process_vector_data(file_path: str) -> Dict[str, Any]:
    """
    Process vector data (GeoJSON, Shapefile) using GeoPandas.
    Provides a safe fallback if GeoPandas is not installed.
    """
    if not os.path.exists(file_path):
        return {"status": "error", "message": f"File not found: {file_path}"}
        
    ext = os.path.splitext(file_path)[1].lower()
    if ext not in ['.geojson', '.shp', '.gpkg']:
        return {"status": "error", "message": f"Unsupported vector format: {ext}"}

    env_status = is_geospatial_env_ready()
    
    if env_status["geopandas"]:
        import geopandas as gpd
        try:
            gdf = gpd.read_file(file_path)
            if gdf.crs is None:
                return {"status": "error", "message": "Vector data is missing CRS."}
                
            original_crs = str(gdf.crs)
            if gdf.crs.to_epsg() != 4326:
                gdf = gdf.to_crs(epsg=4326)
            
            invalid_geom = sum(~gdf.is_valid)
            if invalid_geom > 0:
                gdf = gdf[gdf.is_valid]
                
            bounds = gdf.total_bounds
            overlaps = _check_overlap(bounds)
            
            return {
                "status": "success",
                "format": ext,
                "original_crs": original_crs,
                "current_crs": "EPSG:4326",
                "features_count": len(gdf),
                "invalid_geometries_dropped": int(invalid_geom),
                "bounds": bounds.tolist(),
                "pilot_overlap": overlaps
            }
        except Exception as e:
            logger.error(f"GeoPandas processing failed: {e}")
            return {"status": "error", "message": f"Vector processing failed: {e}"}
    else:
        # Fallback simulation
        logger.warning("GeoPandas not found. Using fallback vector processing.")
        return {
            "status": "success",
            "format": ext,
            "original_crs": "Simulated (Missing GeoPandas)",
            "current_crs": "EPSG:4326 (Simulated)",
            "features_count": "Simulated",
            "invalid_geometries_dropped": 0,
            "bounds": [76.50, 14.90, 76.60, 15.10], # Inside Pilot
            "pilot_overlap": True,
            "fallback_mode": True,
            "message": "GeoPandas is not installed. Simulated processing applied."
        }

def process_raster_data(file_path: str) -> Dict[str, Any]:
    """
    Process raster data (GeoTIFF) using Rasterio.
    Provides a safe fallback if Rasterio is not installed.
    """
    if not os.path.exists(file_path):
        return {"status": "error", "message": f"File not found: {file_path}"}
        
    ext = os.path.splitext(file_path)[1].lower()
    if ext not in ['.tif', '.tiff']:
        return {"status": "error", "message": f"Unsupported raster format: {ext}"}

    env_status = is_geospatial_env_ready()
    
    if env_status["rasterio"]:
        import rasterio
        try:
            with rasterio.open(file_path) as src:
                bounds = [src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top]
                overlaps = _check_overlap(bounds)
                
                return {
                    "status": "success",
                    "format": ext,
                    "crs": src.crs.to_string() if src.crs else "Unknown",
                    "width": src.width,
                    "height": src.height,
                    "bands": src.count,
                    "nodata": src.nodatavals,
                    "bounds": bounds,
                    "pilot_overlap": overlaps
                }
        except Exception as e:
            logger.error(f"Rasterio processing failed: {e}")
            return {"status": "error", "message": f"Raster processing failed: {e}"}
    else:
        # Fallback simulation
        logger.warning("Rasterio not found. Using fallback raster processing.")
        return {
            "status": "success",
            "format": ext,
            "crs": "Simulated (Missing Rasterio)",
            "width": "Simulated",
            "height": "Simulated",
            "bands": "Simulated",
            "nodata": [None],
            "bounds": [76.50, 14.90, 76.60, 15.10], # Inside Pilot
            "pilot_overlap": True,
            "fallback_mode": True,
            "message": "Rasterio is not installed. Simulated processing applied."
        }
