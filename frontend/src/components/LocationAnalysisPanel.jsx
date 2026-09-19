import React from 'react';

const DataRow = ({ label, value, isUnavailable }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</span>
    <span style={{ 
      fontSize: '11px', 
      fontWeight: isUnavailable ? 400 : 600,
      fontStyle: isUnavailable ? 'italic' : 'normal',
      color: isUnavailable ? 'var(--text-muted)' : 'var(--text-primary)',
      textAlign: 'right',
      maxWidth: '60%'
    }}>
      {value || 'Data unavailable'}
    </span>
  </div>
);

const LocationAnalysisPanel = ({ data, onClose }) => {
  if (!data) return null;

  const {
    location = {},
    prediction = {},
    reserve_analysis = {},
    spectral_analysis = {},
    lithological_analysis = {},
    cost_analysis = {},
    risk_analysis = {},
    regulatory = {},
    recommendation_engine = {}
  } = data;

  const prioColor = (p) => p === 'High' ? '#ef4444' : p === 'Medium' ? '#f59e0b' : p === 'Low' ? '#22c55e' : 'var(--text-muted)';
  const pColor = prioColor(prediction.priority);

  return (
    <div className="explore-right-panel fade-up">
      <div className="card" style={{ borderLeft: `3px solid ${pColor}` }}>
        <div className="card-h">
          <div>
            <div className="card-title">Deep Location Analysis</div>
            <div className="card-sub">{location.district || 'Unknown District'}, {location.state || 'Unknown State'}</div>
          </div>
          {onClose && (
            <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={onClose}>✕</button>
          )}
        </div>

        <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 1. Prediction & Priority */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>AI Prediction</span>
              <span style={{ 
                fontSize: 10, fontWeight: 800, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, 
                background: `${pColor}22`, color: pColor, border: `1px solid ${pColor}44`
              }}>
                {prediction.priority || 'Unknown'} Priority
              </span>
            </div>
            <DataRow label="Intensity Score" value={prediction.intensity ? `${Math.round(prediction.intensity * 100)}%` : 'Data unavailable'} />
            <DataRow label="Model Confidence" value={prediction.confidence ? `${Math.round(prediction.confidence * 100)}%` : 'Data unavailable'} />
          </div>

          <div className="div" style={{ margin: 0 }} />

          {/* 2. Location details */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Geospatial Data</div>
            <DataRow label="Latitude" value={location.latitude ? Number(location.latitude).toFixed(5) : 'Data unavailable'} />
            <DataRow label="Longitude" value={location.longitude ? Number(location.longitude).toFixed(5) : 'Data unavailable'} />
            <DataRow label="Closest Known Deposit" value={recommendation_engine.closest_deposit} isUnavailable={!recommendation_engine.closest_deposit} />
            {recommendation_engine.distance_km && <DataRow label="Distance to Deposit" value={`${recommendation_engine.distance_km} km`} />}
          </div>

          <div className="div" style={{ margin: 0 }} />

          {/* 3. Spectral & Lithological */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Geological Signatures</div>
            <DataRow label="Spectral Match" value={spectral_analysis.match} isUnavailable={spectral_analysis.match?.includes('unavailable')} />
            <DataRow label="Lithological Match" value={lithological_analysis.match} isUnavailable={lithological_analysis.match?.includes('unavailable')} />
          </div>

          <div className="div" style={{ margin: 0 }} />

          {/* 4. Reserve & Cost (Usually Unavailable in this prototype) */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Economic Viability</div>
            <DataRow label="Estimated Ore Reserve" value={reserve_analysis.estimated_ore} isUnavailable={true} />
            <DataRow label="Excavation Cost" value={cost_analysis.estimated_cost} isUnavailable={true} />
          </div>

          <div className="div" style={{ margin: 0 }} />

          {/* 5. Risk & Environment */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Risk Assessment</div>
            <DataRow label="Production Risk" value={risk_analysis.production_risk} isUnavailable={risk_analysis.production_risk?.includes('unavailable')} />
            <DataRow label="Terrain / Landslide Risk" value={risk_analysis.terrain_risk} isUnavailable={risk_analysis.terrain_risk?.includes('unavailable')} />
            <DataRow label="Environmental Risk" value={risk_analysis.environmental_risk} isUnavailable={risk_analysis.environmental_risk?.includes('unavailable')} />
          </div>

          {/* 6. Regulatory Warning */}
          {regulatory.restricted_area && (
            <div className="alert alert-error" style={{ marginTop: 8 }}>
              <span>⚠</span>
              <div>
                <strong>Restricted Area</strong>
                <div style={{ marginTop: 2, fontSize: 11, opacity: 0.9 }}>{regulatory.reason}</div>
              </div>
            </div>
          )}
          {!regulatory.restricted_area && regulatory.reason && (
            <div className="alert alert-ok" style={{ marginTop: 8 }}>
              <span>✓</span>
              <div>
                <strong>Clearance Status</strong>
                <div style={{ marginTop: 2, fontSize: 11, opacity: 0.9 }}>{regulatory.reason}</div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default LocationAnalysisPanel;
