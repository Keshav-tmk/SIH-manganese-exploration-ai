import React from 'react';

/**
 * Phase 16: RegionSelector
 * Displays the 6 supported Indian manganese belt regions as a dropdown.
 * When a region is selected, fires onSelectRegion({ lat, lon, regionKey, regionName }).
 */

// Region metadata with center coordinates for auto-fill.
// Bounding box centers are the midpoints of the Phase 15 bbox definitions.
export const SUPPORTED_REGIONS = [
  {
    key: 'sandur_ballari',
    name: 'Sandur-Ballari Manganese Belt',
    state: 'Karnataka',
    centerLat: (14.85 + 15.27) / 2,
    centerLon: (76.45 + 76.75) / 2,
    geologicalNote: 'BIF-hosted Mn deposits in Dharwar Craton greenstone belts',
    color: '#ef4444',  // red
  },
  {
    key: 'nagpur_bhandara',
    name: 'Nagpur-Bhandara Manganese Belt',
    state: 'Maharashtra',
    centerLat: (20.85 + 21.45) / 2,
    centerLon: (79.55 + 80.10) / 2,
    geologicalNote: 'Gondite-type Mn deposits hosted in Precambrian phyllites',
    color: '#f97316',  // orange
  },
  {
    key: 'balaghat',
    name: 'Balaghat Manganese Belt',
    state: 'Madhya Pradesh',
    centerLat: (21.75 + 22.30) / 2,
    centerLon: (80.25 + 80.75) / 2,
    geologicalNote: 'Sedimentary Mn oxide deposits in Gondwana basin margins',
    color: '#eab308',  // yellow
  },
  {
    key: 'sundergarh',
    name: 'Sundergarh Manganese Belt',
    state: 'Odisha',
    centerLat: (22.00 + 22.55) / 2,
    centerLon: (84.05 + 84.55) / 2,
    geologicalNote: 'Lateritized Mn deposits overlying BIF sequences in Eastern Ghats',
    color: '#22c55e',  // green
  },
  {
    key: 'north_goa',
    name: 'North Goa Manganese Belt',
    state: 'Goa',
    centerLat: (15.45 + 15.80) / 2,
    centerLon: (73.85 + 74.25) / 2,
    geologicalNote: 'Laterite-capped Mn enrichments in Deccan ferralitic terrain',
    color: '#06b6d4',  // cyan
  },
  {
    key: 'vizianagaram',
    name: 'Vizianagaram Manganese Belt',
    state: 'Andhra Pradesh',
    centerLat: (18.40 + 18.90) / 2,
    centerLon: (83.35 + 83.85) / 2,
    geologicalNote: 'Metamorphic Mn deposits in Eastern Ghats Mobile Belt khondalites',
    color: '#8b5cf6',  // violet
  },
];

const RegionSelector = ({ selectedKey, onSelectRegion }) => {
  const selectedRegion = SUPPORTED_REGIONS.find(r => r.key === selectedKey);

  const handleChange = (e) => {
    const key = e.target.value;
    if (!key) {
      onSelectRegion(null);
      return;
    }
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
    <div className="space-y-3">
      <div>
        <label htmlFor="region-selector" className="block text-sm font-medium text-gray-700 mb-1">
          Select Region
        </label>
        <select
          id="region-selector"
          value={selectedKey || ''}
          onChange={handleChange}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-white"
        >
          <option value="">— Choose a manganese belt —</option>
          {SUPPORTED_REGIONS.map(r => (
            <option key={r.key} value={r.key}>
              {r.name} ({r.state})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">
          Coordinates auto-fill to the region centre. You can adjust them manually.
        </p>
      </div>

      {selectedRegion && (
        <div
          className="rounded-lg p-3 border text-xs space-y-1"
          style={{ borderColor: selectedRegion.color, backgroundColor: `${selectedRegion.color}10` }}
        >
          <div className="flex items-center gap-2 font-semibold" style={{ color: selectedRegion.color }}>
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: selectedRegion.color }}
            />
            {selectedRegion.state}
          </div>
          <p className="text-gray-600 leading-snug">{selectedRegion.geologicalNote}</p>
          <p className="text-gray-400 font-mono">
            Centre: {selectedRegion.centerLat.toFixed(4)}°N, {selectedRegion.centerLon.toFixed(4)}°E
          </p>
        </div>
      )}
    </div>
  );
};

export default RegionSelector;
