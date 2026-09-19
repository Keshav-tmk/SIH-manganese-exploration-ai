import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, LayersControl, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import { SUPPORTED_REGIONS } from './RegionSelector';

// Fix for default marker icon missing in Leaflet when used with webpack/vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom colored icons for prediction priorities
const createIcon = (colorUrl) => new L.Icon({
  iconUrl: colorUrl,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

// We can use standard colored markers from raw.githubusercontent or similar, 
// but to be safe and self-contained without external assets, we can use 
// Leaflet.divIcon with CSS, or just rely on a CSS filter on the default icon.
// Here we'll use a simple SVG div icon for colored markers.
const createSvgIcon = (color) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); transform: translate(-50%, -50%);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const getPriorityIcon = (priority) => {
  if (priority === 'High') return createSvgIcon('#ef4444'); // red-500
  if (priority === 'Medium') return createSvgIcon('#eab308'); // yellow-500
  if (priority === 'Low') return createSvgIcon('#22c55e'); // green-500
  return DefaultIcon;
};

// Component to recenter map when location changes
const RecenterAutomatically = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

const MapClickHandler = ({ onMapClick, onLayerUnavailable }) => {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
    overlayadd(e) {
      if (onLayerUnavailable && (e.name === 'Geological Boundaries' || e.name === 'Elevation Contours')) {
        onLayerUnavailable(e.name);
      }
    }
  });
  return null;
}

const MapComponent = ({ activeLocation, markers, onMapClick, onLayerUnavailable, pilotRegion, showRegionBboxes, highlightedRegionKey }) => {
  const defaultPosition = [20.5937, 78.9629]; // Center of India
  
  // Parse bounding box if available
  let bounds = null;
  if (pilotRegion && pilotRegion.bounding_box) {
    const { lon_min, lat_min, lon_max, lat_max } = pilotRegion.bounding_box;
    // Leaflet bounds format: [[south, west], [north, east]] -> [[lat_min, lon_min], [lat_max, lon_max]]
    if (lat_min !== undefined && lon_min !== undefined && lat_max !== undefined && lon_max !== undefined) {
      bounds = [[lat_min, lon_min], [lat_max, lon_max]];
    }
  }

  const centerPosition = activeLocation && activeLocation.lat && activeLocation.lng 
    ? [activeLocation.lat, activeLocation.lng] 
    : defaultPosition;

  return (
    <div className="relative h-96 w-full rounded-xl overflow-hidden shadow-lg border border-gray-200">
      {/* Demo overlay label */}
      <div className="absolute top-4 right-4 z-[400] bg-red-600 text-white px-3 py-1 text-xs font-bold rounded shadow">
        DEMO DATA
      </div>
      
      <MapContainer center={centerPosition} zoom={activeLocation ? 8 : 5} scrollWheelZoom={true} className="h-full w-full cursor-crosshair">
        
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap (Default)">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite Imagery">
            <TileLayer
              attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          
          <LayersControl.Overlay name="Geological Boundaries">
            {/* Transparent placeholder that triggers overlayadd event to show warning */}
            <TileLayer url="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" opacity={0} />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Elevation Contours">
            {/* Transparent placeholder that triggers overlayadd event to show warning */}
            <TileLayer url="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" opacity={0} />
          </LayersControl.Overlay>
        </LayersControl>
        
        <MapClickHandler onMapClick={onMapClick} onLayerUnavailable={onLayerUnavailable} />
        
        {/* Render Pilot Region Bounding Box */}
        {bounds && (
          <Rectangle 
            bounds={bounds} 
            pathOptions={{ color: '#3b82f6', weight: 2, fillOpacity: 0.1, dashArray: '5, 5' }} 
          >
            <Popup>
              <div className="font-sans">
                <h3 className="font-bold text-gray-800 border-b pb-1 mb-1">Target Area</h3>
                <p className="text-xs text-gray-600 font-semibold">{pilotRegion.region_name}</p>
                <p className="text-[10px] text-gray-400 mt-1">Data processing constrained to this region.</p>
              </div>
            </Popup>
          </Rectangle>
        )}
        
        {/* Phase 16: Render the 6 supported manganese belt bboxes */}
        {showRegionBboxes && SUPPORTED_REGIONS.map((region) => {
          // Reverse-engineer bbox from center + known bbox extents stored in SUPPORTED_REGIONS
          // We hardcode the bbox corners that match Phase 15 MANGANESE_REGIONS exactly:
          const REGION_BBOXES = {
            sandur_ballari:   { lat_min: 14.85, lat_max: 15.27, lon_min: 76.45, lon_max: 76.75 },
            nagpur_bhandara:  { lat_min: 20.85, lat_max: 21.45, lon_min: 79.55, lon_max: 80.10 },
            balaghat:         { lat_min: 21.75, lat_max: 22.30, lon_min: 80.25, lon_max: 80.75 },
            sundergarh:       { lat_min: 22.00, lat_max: 22.55, lon_min: 84.05, lon_max: 84.55 },
            north_goa:        { lat_min: 15.45, lat_max: 15.80, lon_min: 73.85, lon_max: 74.25 },
            vizianagaram:     { lat_min: 18.40, lat_max: 18.90, lon_min: 83.35, lon_max: 83.85 },
          };
          const bbox = REGION_BBOXES[region.key];
          if (!bbox) return null;
          const leafletBounds = [[bbox.lat_min, bbox.lon_min], [bbox.lat_max, bbox.lon_max]];
          const isHighlighted = highlightedRegionKey === region.key;
          return (
            <Rectangle
              key={region.key}
              bounds={leafletBounds}
              pathOptions={{
                color: region.color,
                weight: isHighlighted ? 3 : 1.5,
                fillOpacity: isHighlighted ? 0.18 : 0.07,
                dashArray: isHighlighted ? '4, 4' : '6, 6',
              }}
            >
              <Popup>
                <div className="font-sans min-w-[200px]">
                  <div className="flex items-center gap-1.5 font-bold text-gray-800 border-b pb-1 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: region.color }} />
                    {region.name}
                  </div>
                  <p className="text-xs text-gray-500 font-semibold">{region.state}</p>
                  <p className="text-[11px] text-gray-600 mt-1 leading-snug">{region.geologicalNote}</p>
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    Phase 15 supported region · Click map or use Region Selector to predict.
                  </p>
                </div>
              </Popup>
            </Rectangle>
          );
        })}

        {activeLocation && activeLocation.lat && activeLocation.lng && (
          <RecenterAutomatically lat={activeLocation.lat} lng={activeLocation.lng} />
        )}

        {/* Render all historical markers */}
        {markers && markers.map((marker, index) => (
          <Marker 
            key={`${marker.lat}-${marker.lng}-${index}`} 
            position={[marker.lat, marker.lng]}
            icon={marker.prediction ? getPriorityIcon(marker.prediction.priority) : DefaultIcon}
          >
            <Popup>
              <div className="font-sans min-w-[200px]">
                <h3 className="font-bold text-gray-800 border-b pb-1 mb-2">Target Location</h3>
                <div className="grid grid-cols-2 gap-x-2 text-sm mb-2">
                  <span className="text-gray-500">Lat:</span>
                  <span className="text-gray-900 font-mono">{Number(marker.lat).toFixed(4)}</span>
                  <span className="text-gray-500">Lng:</span>
                  <span className="text-gray-900 font-mono">{Number(marker.lng).toFixed(4)}</span>
                </div>
                
                {marker.prediction ? (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">ManganEX RF Model</p>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-gray-700">Score:</span>
                      <span className="text-sm font-bold text-blue-600">{marker.prediction.prospectivity_score}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700">Priority:</span>
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                        marker.prediction.priority === 'High' ? 'bg-red-100 text-red-700' :
                        marker.prediction.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {marker.prediction.priority}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-tight">
                      Source: Demo/Sample Data<br/>
                      Not scientifically validated.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-2 italic">Pending Analysis...</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Map Legend */}
      <div className="absolute bottom-6 right-2 z-[400] bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md border border-gray-200 text-xs max-w-[200px]">
        <h4 className="font-bold text-gray-800 mb-2 border-b pb-1">Prospectivity Legend</h4>
        <div className="space-y-1.5">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 border border-white shadow-sm mr-2"></div>
            <span className="text-gray-700">High Priority</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-yellow-500 border border-white shadow-sm mr-2"></div>
            <span className="text-gray-700">Medium Priority</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 border border-white shadow-sm mr-2"></div>
            <span className="text-gray-700">Low Priority</span>
          </div>
        </div>
        {showRegionBboxes && (
          <>
            <h4 className="font-bold text-gray-800 mt-3 mb-1.5 border-t pt-2">Phase 15 Regions</h4>
            <div className="space-y-1">
              {SUPPORTED_REGIONS.map(r => (
                <div key={r.key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-6 flex-shrink-0"
                    style={{ borderBottom: `2px dashed ${r.color}`, display: 'inline-block' }}
                  />
                  <span className="text-gray-600 leading-tight" style={{ fontSize: '10px' }}>
                    {r.state}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="mt-3 pt-2 border-t border-gray-200">
          <p className="text-[10px] text-gray-500 font-medium">Data Sources:</p>
          <ul className="text-[9px] text-gray-400 list-disc list-inside">
            <li>OSM: OpenStreetMap contributors</li>
            <li>Satellite: Esri World Imagery</li>
            <li>Elevation/Geology: Subject to Auth/Acquisition</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;
