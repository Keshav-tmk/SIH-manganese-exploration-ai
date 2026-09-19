# Phase 3 Data Source Research Plan

This document outlines potential real data sources to be integrated in future phases of the ManganEX machine learning model. Currently, ManganEX uses a sample dataset for structural testing. 

## 1. Sentinel-2 Satellite Imagery
- **Dataset Name:** Copernicus Sentinel-2 Multispectral Instrument (MSI)
- **Relevant Variables:** Multi-spectral reflectance (Bands 2, 3, 4, 8 for vegetation; SWIR bands 11, 12 for geological features).
- **Geographic Coverage:** Global
- **File Format/Access:** TIFF files, accessed via Google Earth Engine API or Copernicus Open Access Hub.
- **Licensing:** Open access (Copernicus program).
- **Usage in ManganEX:** To compute indices like NDVI (Normalized Difference Vegetation Index) and mineral indices to identify surface alterations.
- **Limitations:** Cloud cover obscuration, requires atmospheric correction (L2A preferred).

## 2. Landsat 8/9 Satellite Imagery
- **Dataset Name:** USGS Landsat 8/9 Operational Land Imager (OLI)
- **Relevant Variables:** Multi-spectral reflectance, Thermal Infrared (TIRS) bands.
- **Geographic Coverage:** Global
- **File Format/Access:** TIFF files, via USGS EarthExplorer or Google Earth Engine.
- **Licensing:** Public Domain.
- **Usage in ManganEX:** Long-term geological mapping and distinguishing rock types through band ratios.
- **Limitations:** Lower spatial resolution (30m) compared to Sentinel-2 (10m).

## 3. SRTM Elevation Data
- **Dataset Name:** Shuttle Radar Topography Mission (SRTM)
- **Relevant Variables:** Elevation, Slope, Aspect.
- **Geographic Coverage:** Near-global (60°N to 56°S).
- **File Format/Access:** GeoTIFF, via USGS or Earth Engine.
- **Licensing:** Public Domain.
- **Usage in ManganEX:** Topographical context is critical. Slope and elevation can influence mineral deposition and exposure.
- **Limitations:** 30m resolution may miss micro-topography.

## 4. Geological Maps & Mineral Occurrence
- **Dataset Name:** National Geological Maps (e.g., GSI for India, USGS for US)
- **Relevant Variables:** Lithology, structural features (faults, lineaments).
- **Geographic Coverage:** Regional/National.
- **File Format/Access:** Shapefiles (SHP) or GeoJSON from government portals.
- **Licensing:** Varies by country (often open for research but requires attribution).
- **Usage in ManganEX:** Core categorical features for the ML model indicating the underlying rock type.
- **Limitations:** Often generalized; smaller geological features might not be mapped.

## 5. Public Mineral Occurrence Datasets
- **Dataset Name:** Mineral Resources Data System (MRDS) / Local Government Datasets
- **Relevant Variables:** Known mineral deposit locations, commodity types.
- **Geographic Coverage:** Varies.
- **File Format/Access:** CSV / Shapefiles.
- **Licensing:** Usually open access.
- **Usage in ManganEX:** Used as positive labels (ground truth) for training the prospectivity model.
- **Limitations:** Highly biased towards already explored areas; spatial inaccuracy in older records.

---

**Note:** Do not download large datasets automatically. Access should be mediated through scripts that selectively fetch required regions or through cloud-based APIs like Google Earth Engine to avoid overloading local storage.
