import React, { useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
const Plot = createPlotlyComponent(Plotly);

const Visualization3D = ({ 
  activeLocation, 
  activeResult,
  markers, 
  predictionMode,
  showElevation = false,
  showGeology = false,
  theme = 'light'
}) => {
  const isDark = theme === 'dark';

  // Extract data for plotting
  const data = useMemo(() => {
    const currentLat = activeLocation?.lat;
    const currentLng = activeLocation?.lng;
    
    // If no active location is provided, return empty (handled in rendering)
    if (!currentLat || !currentLng) return [];

    const traces = [];

    // Synthetic Terrain Surface
    let centerLat = currentLat;
    let centerLng = currentLng;
    let centerScore = activeResult?.prospectivity_score || 0.8;

    const gridSize = 40;
    const range = 0.2; // degrees (tighter zoom for the 3D model)
    const xSurf = [];
    const ySurf = [];
    const zSurf = [];
    const colorSurf = [];
    
    for(let i=0; i<gridSize; i++) {
      let yRow = [];
      let xRow = [];
      let zRow = [];
      let colorRow = [];
      let cy = centerLat - (range/2) + (i * range / gridSize);
      for(let j=0; j<gridSize; j++) {
        let cx = centerLng - (range/2) + (j * range / gridSize);
        xRow.push(cx);
        yRow.push(cy);
        
        // Synthetic elevation equation
        let dx = (cx - centerLng) * 20;
        let dy = (cy - centerLat) * 20;
        let elevation = Math.sin(dx) * Math.cos(dy) * 100 + Math.sin(dx * 0.5) * 50 + 300;
        zRow.push(elevation);

        // Compute thermal intensity radiating from the center
        let dist = Math.sqrt(Math.pow(cx - centerLng, 2) + Math.pow(cy - centerLat, 2));
        // max dist from center in this grid is ~0.14
        let intensity = Math.max(0, centerScore - (dist * 4)); 
        colorRow.push(intensity);
      }
      xSurf.push(xRow);
      ySurf.push(yRow);
      zSurf.push(zRow);
      colorSurf.push(colorRow);
    }
    
    traces.push({
      type: 'surface',
      x: xSurf[0], 
      y: ySurf.map(r => r[0]),
      z: zSurf,
      surfacecolor: colorSurf,
      colorscale: [
        [0.0, '#0ea5e9'], // Low: Blue
        [0.5, '#eab308'], // Medium: Yellow
        [1.0, '#ef4444']  // High: Red
      ],
      cmin: 0,
      cmax: 1,
      opacity: 0.8,
      showscale: true,
      colorbar: {
        title: 'Intensity',
        titleside: 'right',
        tickfont: { color: isDark ? '#f8fafc' : '#0f172a' },
        titlefont: { color: isDark ? '#f8fafc' : '#0f172a' }
      },
      name: 'Simulated Terrain',
      hoverinfo: 'none'
    });

    // Subsurface Modeled Ore Bodies
    if (centerScore > 0.4) {
      let depths = [250, 200, 150, 100, 50]; // terrain is ~300, these are below ground
      let subX = [], subY = [], subZ = [], subV = [];
      
      depths.forEach((d, idx) => {
          subX.push(centerLng + (Math.random()*0.01 - 0.005));
          subY.push(centerLat + (Math.random()*0.01 - 0.005));
          subZ.push(d);
          subV.push(Math.max(0, centerScore - (idx * 0.1))); 
      });

      traces.push({
        type: 'scatter3d',
        mode: 'markers',
        name: 'Modeled Subsurface Zones',
        x: subX,
        y: subY,
        z: subZ,
        marker: {
          size: subV.map(v => Math.max(10, v * 35)), 
          color: subV,
          colorscale: [
            [0.0, '#0ea5e9'],
            [0.5, '#eab308'],
            [1.0, '#ef4444']
          ],
          cmin: 0,
          cmax: 1,
          opacity: 0.9,
          symbol: 'circle'
        },
        text: subV.map(v => `Modeled Intensity: ${(v*100).toFixed(1)}%<br>Depth: ~${300 - Math.round(subZ[0])}m`),
        hoverinfo: 'text'
      });

      // Target Label
      traces.push({
        type: 'scatter3d',
        mode: 'text',
        name: 'Target Zones',
        x: [centerLng],
        y: [centerLat],
        z: [500], // High above terrain
        text: [`<b>Target Zone 1</b><br>Score: ${(centerScore*100).toFixed(1)}%`],
        textfont: {
          size: 14,
          color: isDark ? '#ffffff' : '#000000',
        },
        textposition: 'top center',
        hoverinfo: 'none'
      });
    }

    return traces;
  }, [activeLocation, activeResult, isDark]);

  if (!activeLocation || !activeLocation.lat || !activeLocation.lng) {
    return (
      <div className="flex-grow w-full h-full relative flex items-center justify-center p-8 text-center" style={{ background: isDark ? '#0f172a' : '#f8fafc', color: isDark ? '#94a3b8' : '#64748b' }}>
        <div>
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="mx-auto mb-4 opacity-50"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
          <h3 className="text-lg font-bold mb-2 text-white">No Location Selected</h3>
          <p>Please select a location on the 2D map to view its 3D subsurface visualization.</p>
        </div>
      </div>
    );
  }

  const layout = {
    title: {
      text: '3D Subsurface Visualization',
      font: { color: isDark ? '#f8fafc' : '#0f172a' }
    },
    autosize: true,
    margin: { l: 0, r: 0, b: 0, t: 40 },
    scene: {
      xaxis: { title: 'Longitude', color: isDark ? '#94a3b8' : '#475569' },
      yaxis: { title: 'Latitude', color: isDark ? '#94a3b8' : '#475569' },
      zaxis: { 
        title: 'Elevation (m)', 
        color: isDark ? '#94a3b8' : '#475569'
      },
      camera: {
        eye: { x: 1.5, y: 1.5, z: 1.2 }
      }
    },
    legend: {
      x: 0,
      y: 1,
      bgcolor: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
      font: { color: isDark ? '#f8fafc' : '#0f172a' }
    },
    paper_bgcolor: isDark ? '#0f172a' : '#f8fafc',
    plot_bgcolor: isDark ? '#0f172a' : '#f8fafc',
  };

  return (
    <div className="relative w-full h-full min-h-[500px] flex flex-col">
      {/* 3D Scene */}
      <div className="flex-grow w-full h-full relative z-0">
        <Plot
          data={data}
          layout={layout}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          config={{ responsive: true, displayModeBar: true }}
        />
      </div>

      {/* Disclaimers & Overlays */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs pointer-events-auto">
          <strong>Modeled Subsurface Zones</strong> (Depth Extrapolated)
        </div>
      </div>

      {(showElevation || showGeology) && (
        <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none">
          <div className="bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded shadow-lg text-sm font-medium pointer-events-auto flex justify-between items-center">
            <span>
              <strong>Data Unavailable:</strong> Reliable {showElevation ? 'Elevation Contours' : ''} {showElevation && showGeology ? 'and' : ''} {showGeology ? 'Geological Boundaries' : ''} cannot be rendered.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Visualization3D;
