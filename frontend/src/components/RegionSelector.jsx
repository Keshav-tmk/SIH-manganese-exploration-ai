import React from 'react';

export const SUPPORTED_REGIONS = [
  { key: 'sandur_ballari', name: 'Sandur-Ballari Manganese Belt', state: 'Karnataka', centerLat: (14.85+15.27)/2, centerLon: (76.45+76.75)/2, geologicalNote: 'BIF-hosted Mn deposits in Dharwar Craton greenstone belts', color: '#ef4444' },
  { key: 'nagpur_bhandara', name: 'Nagpur-Bhandara Manganese Belt', state: 'Maharashtra', centerLat: (20.85+21.45)/2, centerLon: (79.55+80.10)/2, geologicalNote: 'Gondite-type Mn deposits hosted in Precambrian phyllites', color: '#f97316' },
  { key: 'balaghat', name: 'Balaghat Manganese Belt', state: 'Madhya Pradesh', centerLat: (21.75+22.30)/2, centerLon: (80.25+80.75)/2, geologicalNote: 'Sedimentary Mn oxide deposits in Gondwana basin margins', color: '#eab308' },
  { key: 'sundergarh', name: 'Sundergarh Manganese Belt', state: 'Odisha', centerLat: (22.00+22.55)/2, centerLon: (84.05+84.55)/2, geologicalNote: 'Lateritized Mn deposits overlying BIF sequences in Eastern Ghats', color: '#22c55e' },
  { key: 'north_goa', name: 'North Goa Manganese Belt', state: 'Goa', centerLat: (15.45+15.80)/2, centerLon: (73.85+74.25)/2, geologicalNote: 'Laterite-capped Mn enrichments in Deccan ferralitic terrain', color: '#06b6d4' },
  { key: 'vizianagaram', name: 'Vizianagaram Manganese Belt', state: 'Andhra Pradesh', centerLat: (18.40+18.90)/2, centerLon: (83.35+83.85)/2, geologicalNote: 'Metamorphic Mn deposits in Eastern Ghats Mobile Belt khondalites', color: '#8b5cf6' },
];

const RegionSelector = ({ selectedKey, onSelectRegion }) => {
  const selectedRegion = SUPPORTED_REGIONS.find(r => r.key === selectedKey);

  const handleChange = (e) => {
    const key = e.target.value;
    if (!key) { onSelectRegion(null); return; }
    const region = SUPPORTED_REGIONS.find(r => r.key === key);
    if (region) {
      onSelectRegion({
        regionKey: region.key,
        regionName: region.name,
        lat: parseFloat(region.centerLat.toFixed(6)),
        lon: parseFloat(region.centerLon.toFixed(6)),
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <select
        value={selectedKey || ''}
        onChange={handleChange}
        className="form-control"
        style={{ cursor: 'pointer' }}
      >
        <option value="">— Choose a manganese belt —</option>
        {SUPPORTED_REGIONS.map(r => (
          <option key={r.key} value={r.key}>{r.name} ({r.state})</option>
        ))}
      </select>

      {selectedRegion && (
        <div style={{
          borderRadius: 8,
          padding: '10px 12px',
          border: `1px solid ${selectedRegion.color}44`,
          background: `${selectedRegion.color}11`,
          fontSize: 11,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: selectedRegion.color, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: selectedRegion.color, display: 'inline-block', flexShrink: 0 }}></span>
            {selectedRegion.state}
          </div>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 4 }}>{selectedRegion.geologicalNote}</p>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 10 }}>
            Centre: {selectedRegion.centerLat.toFixed(4)}°N, {selectedRegion.centerLon.toFixed(4)}°E
          </p>
        </div>
      )}
    </div>
  );
};

export default RegionSelector;
