# ManganEX Data Sources Registry

This document catalogs the real-world geospatial and geological data sources planned for integration into the ManganEX platform. 

## Target Pilot Region: Sandur-Ballari (Bellary), Karnataka, India
- **Latitude Bounds:** ~14.85° N to 15.27° N
- **Longitude Bounds:** ~76.45° E to 76.75° E
- **Geological Context:** A prominent manganese and iron ore belt in the Dharwar Craton.

## 1. Satellite Imagery

### Sentinel-2 (Copernicus)
- **Source Name:** Copernicus Sentinel-2
- **Official Website:** [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/)
- **Dataset Type:** Optical Multispectral Satellite Imagery
- **Spatial Resolution:** 10m (RGB, NIR), 20m (Red Edge, SWIR), 60m (Coastal, Water vapor)
- **Geographic Coverage:** Global
- **Available Bands:** B1 to B12 (including NIR and SWIR which are crucial for mineral spectroscopy)
- **File Formats:** GeoTIFF, JPEG2000
- **Access Method:** OData API / S3 interface
- **License:** Open Access (Copernicus Sentinel Data Terms and Conditions)
- **API Key Required:** Yes (Free registration)
- **Data Quality Limitations:** Cloud cover can obstruct surface reflectance; requires atmospheric correction (L2A products preferred).

### Landsat 8/9 (USGS)
- **Source Name:** USGS Landsat 8/9
- **Official Website:** [USGS EarthExplorer](https://earthexplorer.usgs.gov/)
- **Dataset Type:** Optical Multispectral and Thermal Imagery
- **Spatial Resolution:** 30m (Multispectral), 15m (Panchromatic), 100m (Thermal)
- **Geographic Coverage:** Global
- **Available Bands:** Coastal/Aerosol, Blue, Green, Red, NIR, SWIR 1, SWIR 2, Panchromatic, Cirrus, TIRS 1, TIRS 2
- **File Formats:** GeoTIFF
- **Access Method:** USGS Machine-to-Machine (M2M) API
- **License:** Public Domain
- **API Key Required:** Yes (Free registration)
- **Data Quality Limitations:** Lower spatial resolution than Sentinel-2; longer revisit time (16 days).

### ISRO Bhuvan (Open Data Archive)
- **Source Name:** ISRO Bhuvan
- **Official Website:** [Bhuvan Geoportal](https://bhuvan.nrsc.gov.in/)
- **Dataset Type:** Multi-resolution Indian Satellite Imagery & Thematic Maps
- **Geographic Coverage:** India
- **Access Method:** Manual Download / WMS
- **API Key Required:** Yes (Bhuvan login)
- **Data Quality Limitations:** Specific layers may require manual processing and authentication.

## 2. Terrain & Elevation Data

### SRTM (Shuttle Radar Topography Mission)
- **Source Name:** NASA SRTM V3 (SRTM Plus)
- **Official Website:** [Earthdata Search](https://search.earthdata.nasa.gov/)
- **Dataset Type:** Digital Elevation Model (DEM)
- **Spatial Resolution:** 30m (1-arc second) globally
- **Geographic Coverage:** Global (60°N to 56°S)
- **Available Attributes:** Elevation (meters above sea level)
- **File Formats:** GeoTIFF, HGT
- **Access Method:** Earthdata API / OpenTopography API
- **License:** Public Domain
- **API Key Required:** Yes (Earthdata Login)
- **Data Quality Limitations:** Voids exist in extreme mountainous regions, though V3 fills most with ASTER GDEM data.

## 3. Geological & Mineral Occurrence Data

### USGS MRDS (Mineral Resources Data System)
- **Source Name:** USGS MRDS
- **Official Website:** [USGS MRDS](https://mrdata.usgs.gov/mrds/)
- **Dataset Type:** Vector Point Data
- **Spatial Resolution:** Point-based (variable accuracy)
- **Geographic Coverage:** Global (primarily US-focused, but contains international records)
- **Available Attributes:** Commodity (e.g., Manganese), Deposit Name, Deposit Type, Development Status, Coordinates
- **File Formats:** Shapefile, CSV, GeoJSON
- **Access Method:** Direct Download (WFS/WMS available)
- **License:** Public Domain
- **API Key Required:** No
- **Data Quality Limitations:** Accuracy of coordinates varies historically; some records are incomplete.

### National Geoscience Data Repository (NGDR) & GSI Bhukosh
- **Source Name:** NGDR / Geological Survey of India (GSI)
- **Official Website:** [NGDR Portal](https://geoscience-data.gov.in/) / [Bhukosh](https://bhukosh.gsi.gov.in/)
- **Dataset Type:** Geological boundaries, lithology shapefiles, mineral occurrences.
- **Geographic Coverage:** India
- **Available Attributes:** Lithology, Stratigraphy, Deposit type.
- **File Formats:** Shapefile, GeoJSON
- **Access Method:** Manual Download (Requires OCBIS credentials)
- **API Key Required:** No (Requires registered user account for Unified Download)
- **Data Quality Limitations:** Manual download required; automation is blocked by authentication layers.

### Macrostrat
- **Source Name:** Macrostrat
- **Official Website:** [Macrostrat](https://macrostrat.org/)
- **Dataset Type:** Geological Polygons / Stratigraphy
- **Spatial Resolution:** Variable (scales from 1:50k to 1:5M)
- **Geographic Coverage:** Global (primarily North America, expanding)
- **Available Attributes:** Lithology, Stratigraphic Age, Rock Type
- **File Formats:** GeoJSON, TopoJSON, Shapefile
- **Access Method:** REST API
- **License:** CC-BY 4.0
- **API Key Required:** No
- **Data Quality Limitations:** Varies by region; highly generalized outside of North America/Oceania.

## 4. Geospatial Boundaries

### Natural Earth
- **Source Name:** Natural Earth Data
- **Official Website:** [Natural Earth](https://www.naturalearthdata.com/)
- **Dataset Type:** Vector Polygons and Lines
- **Spatial Resolution:** 1:10m, 1:50m, 1:110m
- **Geographic Coverage:** Global
- **Available Attributes:** Country borders, states/provinces, populated places, physical features
- **File Formats:** Shapefile, GeoPackage
- **Access Method:** Direct Download
- **License:** Public Domain
- **API Key Required:** No
- **Data Quality Limitations:** Generalized for cartography; not suitable for precise micro-scale targeting.
