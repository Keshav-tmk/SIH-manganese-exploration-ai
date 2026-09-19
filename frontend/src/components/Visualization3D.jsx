import React, { useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
const Plot = createPlotlyComponent(Plotly);

const Visualization3D = ({ 
  activeLocation, 
  markers, 
  predictionMode,
  showElevation = false,
  showGeology = false
}) => {
  // Extract data for plotting
  const data = useMemo(() => {
    // Current point
    const currentLat = activeLocation?.lat;
    const currentLng = activeLocation?.lng;
    
    const traces = [];

    // History markers
    if (markers && markers.length > 0) {
      const lats = markers.map(m => m.lat);
      const lngs = markers.map(m => m.lng);
      // Map Z to a flat 0, or optionally to score if we want pseudo-elevation
      const zs = markers.map(() => 0); 
      
      const colors = markers.map(m => {
        if (m.prediction?.priority === 'High') return '#ef4444'; // red
        if (m.prediction?.priority === 'Medium') return '#eab308'; // yellow
        return '#22c55e'; // green
      });

      const texts = markers.map(m => 
        `Region: ${m.prediction?.region_name || 'Unknown'}<br>` +
        `Score: ${m.prediction?.prospectivity_score?.toFixed(2) || 'N/A'}<br>` +
        `Priority: ${m.prediction?.priority || 'Unknown'}`
      );

      traces.push({
        type: 'scatter3d',
        mode: 'markers',
        name: 'History',
        x: lngs,
        y: lats,
        z: zs,
        marker: {
          size: 6,
          color: colors,
          opacity: 0.8,
          line: { width: 1, color: 'white' }
        },
        text: texts,
        hoverinfo: 'text+x+y',
      });
    }

    // Active prediction point
    if (currentLat !== undefined && currentLng !== undefined) {
      traces.push({
        type: 'scatter3d',
        mode: 'markers',
        name: 'Active Target',
        x: [currentLng],
        y: [currentLat],
        z: [0],
        marker: {
          size: 10,
          color: '#3b82f6', // blue
          symbol: 'diamond',
          opacity: 1,
          line: { width: 2, color: 'white' }
        },
        text: ['Active Selection'],
        hoverinfo: 'text+x+y',
      });
    }

    return traces;
  }, [activeLocation, markers]);

  const layout = {
    title: '3D Geological Prospectivity',
    autosize: true,
    margin: { l: 0, r: 0, b: 0, t: 40 },
    scene: {
      xaxis: { title: 'Longitude' },
      yaxis: { title: 'Latitude' },
      zaxis: { 
        title: 'Elevation (m)', 
        range: [-10, 10], // keep it tight since z=0 for all right now
        showticklabels: false 
      },
      camera: {
        eye: { x: 1.5, y: 1.5, z: 1.5 }
      }
    },
    legend: {
      x: 0,
      y: 1,
      bgcolor: 'rgba(255, 255, 255, 0.8)'
    },
    paper_bgcolor: '#f8fafc', // slate-50
    plot_bgcolor: '#f8fafc',
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

      {/* Overlays / Warnings */}
      <div className="absolute top-4 left-4 right-4 z-10 pointer-events-none">
        <div className="bg-slate-800/80 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-lg border border-slate-700 pointer-events-auto">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-amber-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-semibold">Simulated 3D Visualization</h4>
              <p className="text-xs text-slate-300 mt-1">
                Real high-resolution 3D subsurface and elevation models are currently unavailable. 
                This view maps geographical coordinates and prospectivity scores conceptually on a uniform plane.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mock toggles response */}
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
