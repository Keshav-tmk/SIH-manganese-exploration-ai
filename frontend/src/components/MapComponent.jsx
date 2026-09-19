import React, { useEffect, useState, useRef } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup, Circle, Tooltip,
  useMap, useMapEvents, LayersControl, Rectangle
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SUPPORTED_REGIONS } from './RegionSelector';

// ── Fix Leaflet icons broken by Vite ─────────────────────────────────────────
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, shadowUrl: iconShadow });

// ── Colored dot icons ────────────────────────────────────────────────────────
const dotIcon = (color, size = 14, pulse = false) =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:2.5px solid rgba(255,255,255,0.85);
      border-radius:50%;
      box-shadow:0 0 0 3px ${color}44, 0 2px 8px rgba(0,0,0,0.5);
      ${pulse ? `animation:pulse-dot 1.5s infinite;` : ''}
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
  });

const priorityIcon = (p) => {
  if (p === 'High')   return dotIcon('#ef4444', 16);
  if (p === 'Medium') return dotIcon('#eab308', 14);
  if (p === 'Low')    return dotIcon('#0ea5e9', 12);
  return dotIcon('#3b82f6', 12);
};
const activeMarkerIcon = dotIcon('#ffffff', 20, true);

// ── Priority colors ───────────────────────────────────────────────────────────
const PCOLOR = { High: '#ef4444', Medium: '#eab308', Low: '#0ea5e9' };
const PFILL  = { High: 'rgba(239,68,68,0.2)', Medium: 'rgba(234,179,8,0.2)', Low: 'rgba(14,165,233,0.2)' };

// ── Region bboxes ─────────────────────────────────────────────────────────────
const REGION_BBOXES = {
  sandur_ballari:  { lat_min: 14.85, lat_max: 15.27, lon_min: 76.45, lon_max: 76.75 },
  nagpur_bhandara: { lat_min: 20.85, lat_max: 21.45, lon_min: 79.55, lon_max: 80.10 },
  balaghat:        { lat_min: 21.75, lat_max: 22.30, lon_min: 80.25, lon_max: 80.75 },
  sundergarh:      { lat_min: 22.00, lat_max: 22.55, lon_min: 84.05, lon_max: 84.55 },
  north_goa:       { lat_min: 15.45, lat_max: 15.80, lon_min: 73.85, lon_max: 74.25 },
  vizianagaram:    { lat_min: 18.40, lat_max: 18.90, lon_min: 83.35, lon_max: 83.85 },
};

// ── Sub-components ────────────────────────────────────────────────────────────
const Recenter = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom()); }, [lat, lng, map]);
  return null;
};

const ClickHandler = ({ onMapClick }) => {
  useMapEvents({ click: (e) => onMapClick && onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
};

// ── Popup helper ──────────────────────────────────────────────────────────────
const makePopupHtml = (title, rows) => `
  <div style="font-family:Inter,sans-serif;min-width:180px">
    <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:6px;border-bottom:1px solid #e2e8f0;padding-bottom:4px">${title}</div>
    ${rows.map(([l, v, bold]) =>
      `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
         <span style="color:#475569">${l}:</span>
         <span style="color:${bold ? '#0f172a' : '#64748b'};font-weight:${bold ? 700 : 400}">${v}</span>
       </div>`
    ).join('')}
  </div>`;

// ── Map Layer Selector (in-map control) ──────────────────────────────────────
const LayerSelector = ({ activeLayer, onChange }) => {
  const layers = [
    { id: 'street',      label: '🗺 Street' },
    { id: 'satellite',   label: '🛰 Satellite' },
    { id: 'prospectivity', label: '🟡 Zones' },
  ];
  return (
    <div style={{
      position: 'absolute', top: 10, left: 10, zIndex: 1000,
      display: 'flex', gap: 4,
      background: 'rgba(10,14,26,0.90)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8, padding: 4, backdropFilter: 'blur(6px)',
    }}>
      {layers.map(l => (
        <button
          key={l.id}
          onClick={() => onChange(l.id)}
          style={{
            padding: '5px 10px', borderRadius: 5,
            fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            background: activeLayer === l.id ? '#00d084' : 'transparent',
            color:      activeLayer === l.id ? '#0a1a0f' : 'rgba(255,255,255,0.6)',
            transition: 'all 0.12s',
          }}
        >{l.label}</button>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const MapComponent = ({
  activeLocation,
  markers = [],
  onMapClick,
  showRegionBboxes = false,
  highlightedRegionKey = null,
  heatmapZones = [],          // from /api/prospectivity/heatmap
  forcedLayer = null,
}) => {
  const [mapLayer, setMapLayer] = useState('street'); // street | satellite | prospectivity
  const center  = [20.5937, 78.9629];
  const hasActive = activeLocation?.lat && activeLocation?.lng;

  const currentLayer = forcedLayer || mapLayer;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>

      {/* ── Custom in-map layer toggle ─────────────────────── */}
      {!forcedLayer && <LayerSelector activeLayer={mapLayer} onChange={setMapLayer} />}

      {/* ── Leaflet map ────────────────────────────────────── */}
      <MapContainer
        center={hasActive ? [activeLocation.lat, activeLocation.lng] : center}
        zoom={hasActive ? 9 : 5}
        scrollWheelZoom
        style={{ height: '100%', width: '100%', cursor: 'crosshair', background: '#131c2e' }}
        zoomControl={false}
      >
        {/* Base tile layers */}
        {currentLayer === 'street' && (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
        )}
        {currentLayer === 'satellite' && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="&copy; Esri"
          />
        )}
        {currentLayer === 'prospectivity' && (
          <>
            {/* Dim street as base for prospectivity overlay */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
              opacity={0.3}
            />
            {/* Prospectivity zone circles — render Low first, High last (on top) */}
            {[...heatmapZones].reverse().map((z, i) => {
              const color  = PCOLOR[z.priority]  || '#94a3b8';
              const fill   = PFILL[z.priority]   || 'rgba(148,163,184,0.08)';
              const radius = (z.radius_km || 10) * 1000; // metres
              return (
                <Circle
                  key={`zone-${i}`}
                  center={[z.lat, z.lon]}
                  radius={radius}
                  pathOptions={{ color, weight: 1.5, fillColor: fill, fillOpacity: 0.8 }}
                  eventHandlers={{
                    click: (e) => {
                      e.originalEvent?.stopPropagation();
                      if (onMapClick) onMapClick(z.lat, z.lon);
                    }
                  }}
                >
                  <Tooltip sticky direction="top">
                    <span style={{ fontSize: 11 }}>
                      <strong>{z.name}</strong> · {z.priority}
                      <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>Click for deep analysis</div>
                    </span>
                  </Tooltip>
                </Circle>
              );
            })}
            {/* Also show deposit dot markers on prospectivity layer */}
            {heatmapZones.map((z, i) => (
              <Marker 
                key={`dot-${i}`} 
                position={[z.lat, z.lon]} 
                icon={priorityIcon(z.priority)}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent?.stopPropagation();
                    if (onMapClick) onMapClick(z.lat, z.lon);
                  }
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <div style={{ fontSize: 11, textAlign: 'center' }}>
                    <strong>{z.name}</strong>
                    <div style={{ color: 'var(--text-muted)' }}>Click to analyse</div>
                  </div>
                </Tooltip>
              </Marker>
            ))}
          </>
        )}

        {/* Click handler */}
        <ClickHandler onMapClick={onMapClick} />

        {/* Auto-recenter */}
        {hasActive && <Recenter lat={activeLocation.lat} lng={activeLocation.lng} />}

        {/* Active location marker */}
        {hasActive && (
          <Marker position={[activeLocation.lat, activeLocation.lng]} icon={activeMarkerIcon}>
            <Popup>
              <div dangerouslySetInnerHTML={{ __html: makePopupHtml('Selected Location', [
                ['Lat', `${activeLocation.lat.toFixed(5)}°N`, true],
                ['Lon', `${activeLocation.lng.toFixed(5)}°E`, true],
              ]) }} />
            </Popup>
          </Marker>
        )}

        {/* Historical prediction markers (street + satellite layers) */}
        {mapLayer !== 'prospectivity' && markers.map((m, i) => (
          <Marker 
            key={`pred-${m.id||i}`} 
            position={[m.lat, m.lng]}
            icon={priorityIcon(m.result?.priority)}
            eventHandlers={{
              click: (e) => {
                e.originalEvent?.stopPropagation();
                if (onMapClick) onMapClick(m.lat, m.lng);
              }
            }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <div style={{ fontSize: 11, textAlign: 'center' }}>
                <strong>{m.result?.region_name || 'Prediction Point'}</strong>
                <div style={{ color: 'var(--text-muted)' }}>Click to analyse</div>
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* Region belt bounding boxes */}
        {showRegionBboxes && mapLayer !== 'prospectivity' && SUPPORTED_REGIONS.map(region => {
          const bb = REGION_BBOXES[region.key];
          if (!bb) return null;
          const isHighlit = highlightedRegionKey === region.key;
          return (
            <Rectangle
              key={region.key}
              bounds={[[bb.lat_min, bb.lon_min], [bb.lat_max, bb.lon_max]]}
              pathOptions={{
                color: region.color, weight: isHighlit ? 2.5 : 1.5,
                fillOpacity: isHighlit ? 0.12 : 0.04,
                dashArray: isHighlit ? '5 4' : '7 5',
              }}
            >
              <Popup>
                <div dangerouslySetInnerHTML={{ __html: makePopupHtml(region.name, [
                  ['State', region.state, true],
                  ['Type', region.geologicalNote.split(' ').slice(0,5).join(' ') + '…'],
                ]) }} />
              </Popup>
            </Rectangle>
          );
        })}
      </MapContainer>

      {/* ── Legend overlay ───────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 30, left: 10, zIndex: 1000,
        background: 'rgba(10,14,26,0.90)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, padding: '8px 12px',
        backdropFilter: 'blur(8px)', fontSize: 11, color: '#94a3b8',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 5, color: '#e2e8f0', fontSize: 10,
                      textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {mapLayer === 'prospectivity' ? 'Prospectivity Zones' : 'Prediction Markers'}
        </div>
        {[['#22c55e','Low','Low priority zone'],['#f59e0b','Medium','Medium priority zone'],['#ef4444','High','High priority zone']].map(([c,l,hint]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }} title={hint}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: c,
                           boxShadow: `0 0 6px ${c}88`, display: 'inline-block', flexShrink: 0 }}></span>
            {l}
          </div>
        ))}
        <div style={{ marginTop: 6, paddingTop: 5, borderTop: '1px solid rgba(255,255,255,0.08)',
                      fontSize: 9, opacity: 0.5 }}>
          AI prospectivity · not confirmed reserves
        </div>
      </div>

      {/* Pulse keyframe */}
      <style>{`
        @keyframes pulse-dot {
          0%,100% { box-shadow: 0 0 0 3px rgba(255,255,255,0.5); }
          50%      { box-shadow: 0 0 0 8px rgba(255,255,255,0.1); }
        }
      `}</style>
    </div>
  );
};

export default MapComponent;
