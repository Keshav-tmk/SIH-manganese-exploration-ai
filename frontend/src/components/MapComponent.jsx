import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, LayersControl, Rectangle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

// Component to handle map clicks
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

const MapComponent = ({ activeLocation, markers, onMapClick, pilotRegion }) => {
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
          <LayersControl.BaseLayer name="Satellite Imagery (Coming Soon)">
            {/* Placeholder - using standard OSM for now to represent future satellite integration */}
            <TileLayer
              attribution='&copy; Satellite Provider Placeholder'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="filter grayscale" 
            />
          </LayersControl.BaseLayer>
          
          <LayersControl.Overlay name="Geological Boundaries (Coming Soon)">
            {/* Placeholder for geological WMS or GeoJSON layers */}
            <TileLayer url="" />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Elevation Contours (Coming Soon)">
            <TileLayer url="" />
          </LayersControl.Overlay>
        </LayersControl>
        
        <MapClickHandler onMapClick={onMapClick} />
        
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
      <div className="absolute bottom-6 right-2 z-[400] bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md border border-gray-200 text-xs">
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
      </div>
    </div>
  );
};

export default MapComponent;
