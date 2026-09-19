import React, { useState, useEffect, useRef } from 'react';
import { checkHealth, predictProspectivity, predictMultiRegion, checkModelStatus, checkGeospatialStatus, predictDetailedAnalysis } from './services/api';
import MapComponent from './components/MapComponent';
import Visualization3D from './components/Visualization3D';
import ForecastDashboard from './components/ForecastDashboard';
import RegionSelector from './components/RegionSelector';
import StateSearch from './components/StateSearch';
import LocationAnalysisPanel from './components/LocationAnalysisPanel';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import './index.css';

// ── Tiny SVG icons ───────────────────────────────────────────────────────────
const Ic = {
  Grid:   () => <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  Map:    () => <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4"/></svg>,
  Search: () => <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>,
  Risk:   () => <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>,
  AI:     () => <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>,
  Cube3D: () => <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>,
  Trash:  () => <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
  Refresh:() => <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>,
  Sun:    () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path strokeLinecap="round" strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  Moon:   () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  Pin:    () => <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
};

const NavItem = ({ icon, label, active, onClick }) => (
  <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
    {icon}<span>{label}</span>
  </button>
);

const Badge = ({ priority }) => {
  const p = (priority || '').toLowerCase();
  return <span className={`badge badge-${p}`}>{priority || 'N/A'}</span>;
};

// ── Main App ─────────────────────────────────────────────────────────────────
function App() {
  // Theme
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Page nav
  const [page, setPage] = useState('explore'); // explore | state-search | forecast | reserve

  // System status
  const [health, setHealth]   = useState('...');
  const [model, setModel]     = useState('...');
  const [geo, setGeo]         = useState('...');

  // Heatmap zones
  const [heatmapZones, setHeatmapZones] = useState([]);

  // Prediction state
  const [coords, setCoords] = useState({ lat: '', lng: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [result, setResult] = useState(null);
  const [detailedData, setDetailedData] = useState(null);
  const [mapLoc, setMapLoc] = useState(null);

  // Mode & region
  const [mode, setMode]   = useState('multiregion');
  const [regionKey, setRegionKey] = useState(null);

  // History & filter
  const [history, setHistory] = useState([]);
  const [filter, setFilter]   = useState('All');

  // View
  const [viewMode, setViewMode] = useState('2d'); // '2d' | '3d' | 'intensity'

  // Layer warning
  const [layerWarn, setLayerWarn] = useState(null);

  // ── Status & Heatmap ──────────────────────────────────────────
  useEffect(() => {
    checkHealth().then(() => setHealth('Online')).catch(() => setHealth('Offline'));
    checkModelStatus().then(r => setModel(r.status || 'Online')).catch(() => setModel('Offline'));
    checkGeospatialStatus().then(r => setGeo(r.status || 'Online')).catch(() => setGeo('Offline'));

    // Fetch heatmap zones
    const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    fetch(`${base}/prospectivity/heatmap`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') setHeatmapZones(data.zones || []);
      })
      .catch(err => console.warn('Failed to load heatmap zones', err));
  }, []);

  const handleLayerUnavail = (n) => { setLayerWarn(n); setTimeout(() => setLayerWarn(null), 4000); };

  // ── Map click ─────────────────────────────────────────────────
  const handleMapClick = (lat, lng) => {
    setCoords({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
    setResult(null);
    setDetailedData(null);
    setError(null);
    setMapLoc({ lat, lng });
    if (mode === 'multiregion') setRegionKey(null);
    
    // Auto-predict on map click to load side panel immediately
    setTimeout(() => {
      document.getElementById('predict-btn')?.click();
    }, 50);
  };

  // ── Submit prediction ─────────────────────────────────────────
  const handlePredict = async (e) => {
    e && e.preventDefault();
    const lat = parseFloat(coords.lat);
    const lng = parseFloat(coords.lng);
    if (isNaN(lat) || isNaN(lng)) { setError('Enter valid coordinates or click the map.'); return; }
    if (lat < -90 || lat > 90)   { setError('Latitude must be −90 to 90.'); return; }
    if (lng < -180 || lng > 180) { setError('Longitude must be −180 to 180.'); return; }

    setLoading(true); setError(null); setResult(null); setDetailedData(null);
    setMapLoc({ lat, lng });

    try {
      // Execute both standard and detailed predictions in parallel
      const req = { latitude: lat, longitude: lng };
      
      const p1 = mode === 'multiregion' ? predictMultiRegion(req) : predictProspectivity(req);
      const p2 = predictDetailedAnalysis(req);
      
      const [data, detailed] = await Promise.all([p1, p2]);

      setResult(data);
      setDetailedData(detailed);
      setHistory(prev => [{ id: Date.now(), ts: new Date().toLocaleTimeString(), lat, lng, result: data }, ...prev]);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Prediction service error.');
    } finally { setLoading(false); }
  };

  const handleReset = () => { setCoords({ lat: '', lng: '' }); setResult(null); setDetailedData(null); setError(null); setMapLoc(null); setRegionKey(null); };
  const handleClearHistory = () => { setHistory([]); setMapLoc(null); setResult(null); setDetailedData(null); };

  const filteredHistory = history.filter(h => filter === 'All' || h.result?.priority === filter);

  // Stats
  const highCount   = history.filter(h => h.result?.priority === 'High').length;
  const medCount    = history.filter(h => h.result?.priority === 'Medium').length;
  const lowCount    = history.filter(h => h.result?.priority === 'Low').length;
  const isOnline    = health === 'Online';
  const isModelOk   = model !== 'Offline' && model !== '...';
  const isGeoOk     = geo   !== 'Offline' && geo   !== '...';

  // ── Priority color helper ────────────────────────────────────
  const prioColor = (p) => p === 'High' ? '#ef4444' : p === 'Medium' ? '#f59e0b' : '#22c55e';

  return (
    <div className="app-shell">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-name">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
            ManganEX
          </div>
          <div className="sidebar-logo-sub">Mining Intelligence Platform</div>
        </div>

        <nav className="sidebar-nav">
          <NavItem icon={<Ic.Map />}    label="Exploration Map"   active={page === 'explore'}       onClick={() => setPage('explore')} />
          <NavItem icon={<Ic.Grid />}   label="Reserve Analysis"  active={page === 'reserve'}       onClick={() => setPage('reserve')} />
          <NavItem icon={<Ic.Risk />}   label="Production Risk"   active={page === 'forecast'}      onClick={() => setPage('forecast')} />
          <NavItem icon={<Ic.AI />}     label="AI Insights"       active={page === 'ai'}            onClick={() => setPage('ai')} />
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <span className={`status-dot ${isOnline ? '' : 'offline'}`} />
            Backend {isOnline ? 'Online' : 'Offline'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <span className={`status-dot ${isModelOk ? '' : 'offline'}`} />
            Model {isModelOk ? 'Ready' : 'Loading'}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, opacity: 0.4 }}>AI + Space Technology · SIH 2024</div>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────── */}
      <div className="main-area">

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-title">
            <h2>{page === 'explore' ? 'Exploration Map' : page === 'state-search' ? 'State-wise Search' : page === 'reserve' ? 'Reserve Analysis' : page === 'forecast' ? 'Production Risk' : 'AI Insights'}</h2>
            <p>Manganese Prospectivity Intelligence</p>
          </div>
          <div className="topbar-right">
            <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Toggle theme">
              {theme === 'dark' ? <Ic.Sun /> : <Ic.Moon />}
            </button>
          </div>
        </header>

        {/* ═══ EXPLORATION MAP ═══════════════════════════════════ */}
        {page === 'explore' && (
          <div className="page" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div className="explore-shell" style={{ padding: '14px 20px', flex: 1 }}>

              {/* ── Left panel ── */}
              <div className="explore-panel">

                {/* Mode + Region selector */}
                <div className="card">
                  <div className="card-h"><span className="card-title">Analysis Mode</span></div>
                  <div className="card-b" style={{ paddingBottom: 12 }}>
                    <div className="tabs" style={{ marginBottom: 10 }}>
                      <button className={`tab ${mode === 'multiregion' ? 'active' : ''}`} onClick={() => { setMode('multiregion'); setResult(null); }}>Multi-Region</button>
                      <button className={`tab ${mode === 'single' ? 'active' : ''}`}      onClick={() => { setMode('single'); setRegionKey(null); setResult(null); }}>Single</button>
                      <button className={`tab ${mode === 'state' ? 'active' : ''}`}       onClick={() => { setMode('state'); setRegionKey(null); setResult(null); }}>State Search</button>
                    </div>

                    {mode === 'state' && (
                      <div style={{ marginTop: 10 }}>
                        <StateSearch onDepositClick={handleMapClick} />
                      </div>
                    )}

                    {mode === 'multiregion' && (
                      <div style={{ marginBottom: 10 }}>
                        <label className="fl">Manganese Belt</label>
                        <RegionSelector selectedKey={regionKey} onSelectRegion={(r) => {
                          if (!r) { setRegionKey(null); return; }
                          setRegionKey(r.regionKey);
                          setCoords({ lat: String(r.lat), lng: String(r.lon) });
                          setMapLoc({ lat: r.lat, lng: r.lon });
                          setResult(null);
                        }} />
                      </div>
                    )}

                    {mode !== 'state' && (
                      <form onSubmit={handlePredict}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <div>
                            <label className="fl">Latitude</label>
                            <input className="fc" type="number" step="any" placeholder="e.g. 15.06"
                              value={coords.lat} onChange={e => setCoords(p => ({ ...p, lat: e.target.value }))} />
                          </div>
                          <div>
                            <label className="fl">Longitude</label>
                            <input className="fc" type="number" step="any" placeholder="e.g. 76.60"
                              value={coords.lng} onChange={e => setCoords(p => ({ ...p, lng: e.target.value }))} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button id="predict-btn" type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                            {loading ? <><span className="spin" />&nbsp;Analysing…</> : '⚡ Analyse Location'}
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={handleReset} title="Reset"><Ic.Refresh /></button>
                        </div>
                      </form>
                    )}

                    {error && <div className="alert alert-error" style={{ marginTop: 10 }}><span>⚠</span>{error}</div>}
                    {mode !== 'state' && (
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
                        💡 Click anywhere on the map to set coordinates automatically
                      </p>
                    )}
                  </div>
                </div>

                {/* Result card */}
                {result && !loading && result.is_validated_region !== false && (
                  <div className="card fade-up">
                    <div className="card-h" style={{
                      background: `${prioColor(result.priority)}14`,
                      borderBottomColor: `${prioColor(result.priority)}33`,
                    }}>
                      <div>
                        <div className="card-title">Prospectivity Result</div>
                        {result.region_name && <div className="card-sub">📍 {result.region_name}</div>}
                      </div>
                      <Badge priority={result.priority} />
                    </div>
                    <div className="card-b">
                      <div className="score-big">
                        <div className="score-num" style={{ color: prioColor(result.priority) }}>
                          {result.prospectivity_score !== undefined ? `${Math.round(result.prospectivity_score * 100)}%` : '—'}
                        </div>
                        <div className="score-lbl">AI Prospectivity Score</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{result.prediction_label}</div>
                      </div>

                      {result.nearest_deposit_name && (
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '7px 10px', marginBottom: 10, fontSize: 11, border: '1px solid var(--border-color)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Nearest known deposit: </span>
                          <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{result.nearest_deposit_name}</span>
                          <span style={{ color: 'var(--text-muted)' }}> · {result.nearest_deposit_dist_km} km away</span>
                        </div>
                      )}

                      {result.probabilities && Object.entries(result.probabilities).map(([lbl, prob]) => (
                        <div key={lbl} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{lbl}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: prioColor(lbl) }}>{(prob * 100).toFixed(1)}%</span>
                          </div>
                          <div className="pbar"><div className={`pfill ${lbl === 'High' ? 'red' : lbl === 'Medium' ? 'yellow' : 'green'}`} style={{ width: `${prob * 100}%` }} /></div>
                        </div>
                      ))}

                      {result.explainability?.feature_importance?.length > 0 && (
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Top Feature Drivers</div>
                          {result.explainability.feature_importance.slice(0, 5).map((fi, i) => (
                            <div key={i} style={{ marginBottom: 7 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{fi.feature}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-green)' }}>{(fi.importance * 100).toFixed(1)}%</span>
                              </div>
                              <div className="pbar"><div className="pfill green" style={{ width: `${fi.importance * 100}%` }} /></div>
                            </div>
                          ))}
                        </div>
                      )}

                      {result.explanation && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.55, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                          {result.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {result && result.is_validated_region === false && (
                  <div className="alert alert-warn"><span>⚠</span><div>
                    <b>Outside Supported Region</b>
                    <p style={{ marginTop: 3 }}>{result.message}</p>
                  </div></div>
                )}

                {/* Marker filter */}
                {history.length > 0 && (
                  <div className="card">
                    <div className="card-h">
                      <span className="card-title">Filter ({filteredHistory.length}/{history.length})</span>
                      <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 11 }} onClick={handleClearHistory}><Ic.Trash /> Clear</button>
                    </div>
                    <div className="card-b">
                      <div className="tabs">
                        {['All', 'High', 'Medium', 'Low'].map(f => (
                          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right: map/3D ── */}
              <div className="explore-main">
                {/* View bar */}
                <div className="card" style={{ flexShrink: 0 }}>
                  <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div className="tabs" style={{ width: 'auto', flex: 'none' }}>
                      <button className={`tab ${viewMode === '2d' ? 'active' : ''}`} onClick={() => setViewMode('2d')}>2D Map</button>
                      <button className={`tab ${viewMode === '3d' ? 'active' : ''}`}  onClick={() => setViewMode('3d')}><Ic.Cube3D /> 3D View</button>
                      <button className={`tab ${viewMode === 'intensity' ? 'active' : ''}`} onClick={() => setViewMode('intensity')}>Intensity Map</button>
                    </div>
                    {layerWarn && <div className="alert alert-warn" style={{ padding: '4px 10px', border: 'none', fontSize: 11 }}>⚠ {layerWarn} unavailable in demo mode</div>}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                      {[['#0ea5e9','Low'],['#eab308','Medium'],['#ef4444','High']].map(([c,l]) => (
                        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }}></span>{l}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Map / 3D */}
                <div style={{ flex: 1, minHeight: 0 }}>
                  {viewMode !== '3d' ? (
                    <div className="map-wrap">
                      <MapComponent
                        markers={filteredHistory}
                        activeLocation={mapLoc}
                        onMapClick={handleMapClick}
                        predictionMode={mode}
                        onLayerUnavailable={handleLayerUnavail}
                        showRegionBboxes={mode === 'multiregion'}
                        highlightedRegionKey={regionKey}
                        heatmapZones={heatmapZones}
                        forcedLayer={viewMode === 'intensity' ? 'prospectivity' : null}
                      />
                    </div>
                  ) : (
                    <div className="map-wrap" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                      <Visualization3D activeLocation={mapLoc} activeResult={result} markers={filteredHistory} predictionMode={mode} theme={theme} />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right Panel ── */}
              {detailedData && (
                <LocationAnalysisPanel 
                  data={detailedData} 
                  onClose={() => setDetailedData(null)} 
                />
              )}

            </div>
          </div>
        )}

        {/* ═══ STATE SEARCH ══════════════════════════════════════ */}
        {page === 'state-search' && (
          <div className="page">
            <div className="ss-layout">
              {/* Left sidebar */}
              <div className="ss-panel">
                <div className="card">
                  <div className="card-h"><span className="card-title">Search by State or Region</span></div>
                  <div className="card-b">
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Enter an Indian state name to discover all known manganese-bearing regions and ore deposit locations within it.
                    </p>
                    <StateSearch onDepositClick={(lat, lon) => {
                      setMapLoc({ lat, lng: lon });
                      setCoords({ lat: String(lat), lng: String(lon) });
                      setPage('explore');
                    }} />
                  </div>
                </div>

                {/* Quick access */}
                <div className="card">
                  <div className="card-h"><span className="card-title">Quick Access</span></div>
                  <div className="card-b" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                    {[
                      { name: 'Karnataka',        color: '#ef4444' },
                      { name: 'Maharashtra',       color: '#f97316' },
                      { name: 'Madhya Pradesh',    color: '#eab308' },
                      { name: 'Odisha',            color: '#22c55e' },
                      { name: 'Goa',               color: '#06b6d4' },
                      { name: 'Andhra Pradesh',    color: '#8b5cf6' },
                    ].map(s => (
                      <div key={s.name} className="dep-row" style={{ cursor: 'pointer' }}
                        onClick={() => window.dispatchEvent(new CustomEvent('stateSearch', { detail: s.name }))}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }}></span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: map preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="card" style={{ flex: '0 0 auto' }}>
                  <div className="card-h"><span className="card-title">Deposit Location Map</span><span className="card-sub">Click a deposit to jump to Exploration Map</span></div>
                  <div style={{ height: 320 }}>
                    <MapComponent markers={filteredHistory} activeLocation={mapLoc}
                      onMapClick={(lat, lng) => { handleMapClick(lat, lng); setPage('explore'); }}
                      predictionMode={mode} onLayerUnavailable={handleLayerUnavail}
                      showRegionBboxes={true} />
                  </div>
                </div>
                <div className="alert alert-info">
                  <span>ℹ</span>
                  <span>Results show documented manganese deposit regions from the ManganEX geological training database. Deposit locations represent known ore occurrences — not guaranteed active reserves.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ RESERVE ANALYSIS ═════════════════════════════════ */}
        {page === 'reserve' && (
          <div className="page">
            {/* Stat row */}
            <div className="stat-grid">
              {[
                { label: 'Total Known Reserve', value: '154.6 MT', sub: 'Documented regional estimate', cls: 'sc-green', vc: 'green' },
                { label: 'AI Prospectivity Area', value: '2,840 km²', sub: 'AI decision-support coverage', cls: 'sc-blue', vc: 'blue' },
                { label: 'High Priority Zones', value: highCount || '12', sub: 'AI-identified zones', cls: 'sc-red', vc: 'red' },
                { label: 'Geological Confidence', value: '84%', sub: 'Composite model confidence', cls: 'sc-purple', vc: 'purple' },
              ].map(s => (
                <div key={s.label} className={`stat-card ${s.cls}`}>
                  <div className="stat-label">{s.label}</div>
                  <div className={`stat-value ${s.vc}`}>{s.value}</div>
                  <div className="stat-sub">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="grid2" style={{ marginBottom: 14 }}>
              {/* Map */}
              <div className="card">
                <div className="card-h">
                  <div><div className="card-title">Regional Prospectivity Map</div><div className="card-sub">Click to explore a location</div></div>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setPage('explore')}>Full Map →</button>
                </div>
                <div style={{ height: 280 }}>
                  <MapComponent markers={filteredHistory} activeLocation={mapLoc}
                    onMapClick={(lat, lng) => { handleMapClick(lat, lng); setPage('explore'); }}
                    predictionMode={mode} onLayerUnavailable={handleLayerUnavail} showRegionBboxes={true} />
                </div>
              </div>

              {/* Geological indicators */}
              <div className="card">
                <div className="card-h"><span className="card-title">Geological Indicators</span></div>
                <div className="card-b">
                  {[
                    { l: 'Spectral similarity',   v: '87%', p: 87, c: 'green' },
                    { l: 'Lithology match',        v: '82%', p: 82, c: 'green' },
                    { l: 'Terrain suitability',    v: '76%', p: 76, c: 'yellow' },
                    { l: 'Occurrence proximity',   v: '91%', p: 91, c: 'green' },
                  ].map(ind => (
                    <div key={ind.l} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ind.l}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)' }}>{ind.v}</span>
                      </div>
                      <div className="pbar" style={{ height: 6 }}><div className={`pfill ${ind.c}`} style={{ width: `${ind.p}%` }} /></div>
                    </div>
                  ))}

                  <div className="div" />
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Satellite Indicators</div>
                  {[['NDVI anomaly', '+0.18'], ['Iron oxide signature', 'Strong'], ['Moisture-adj. reflectance', '0.74']].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Zone table */}
            <div className="card">
              <div className="card-h">
                <div><div className="card-title">Priority Areas</div><div className="card-sub">AI-assigned zone prioritisation from prediction history</div></div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['All', 'High', 'Medium', 'Low'].map(f => (
                    <button key={f} className={`tab ${filter === f ? 'active' : ''}`} style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setFilter(f)}>{f}</button>
                  ))}
                </div>
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {filteredHistory.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No zones yet — <span style={{ color: 'var(--accent-green)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setPage('explore')}>start exploring</span>
                  </div>
                ) : (
                  <table className="tbl">
                    <thead><tr><th>Zone</th><th>Lat</th><th>Lon</th><th>Score</th><th>Priority</th><th>Status</th></tr></thead>
                    <tbody>
                      {filteredHistory.map((h, i) => (
                        <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => { setMapLoc({ lat: h.lat, lng: h.lng }); setCoords({ lat: String(h.lat), lng: String(h.lng) }); setResult(h.result); setPage('explore'); }}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Zone {String.fromCharCode(65 + i)}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.lat.toFixed(3)}°N</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.lng.toFixed(3)}°E</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                            {h.result?.prospectivity_score !== undefined ? `${Math.round(h.result.prospectivity_score * 100)}%` : '—'}
                          </td>
                          <td><Badge priority={h.result?.priority} /></td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {h.result?.priority === 'High' ? 'Ready for review' : h.result?.priority === 'Medium' ? 'Pending validation' : 'Monitoring'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ PRODUCTION RISK ══════════════════════════════════ */}
        {page === 'forecast' && (
          <div className="page">
            <ForecastDashboard />
          </div>
        )}

        {/* ═══ AI INSIGHTS ══════════════════════════════════════ */}
        {page === 'ai' && (
          <div className="page">
            <div className="stat-grid">
              {[
                { label: 'Active Alerts',          value: '3',   vc: 'red',    cls: 'sc-red'    },
                { label: 'Model Accuracy',          value: '84%', vc: 'green',  cls: 'sc-green'  },
                { label: 'Training Regions',        value: '6',   vc: 'blue',   cls: 'sc-blue'   },
                { label: 'Predictions This Session',value: history.length.toString(), vc: 'purple', cls: 'sc-purple' },
              ].map(s => (
                <div key={s.label} className={`stat-card ${s.cls}`}>
                  <div className="stat-label">{s.label}</div>
                  <div className={`stat-value ${s.vc}`}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="grid3" style={{ gridTemplateColumns: history.length > 0 ? '1fr 2fr' : '1fr' }}>
              {history.length > 0 && (
                <div className="card">
                  <div className="card-h"><span className="card-title">Prediction Distribution</span></div>
                  <div className="card-b" style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'High', value: history.filter(h => h.result?.priority === 'High').length, color: '#ef4444' },
                            { name: 'Medium', value: history.filter(h => h.result?.priority === 'Medium').length, color: '#f59e0b' },
                            { name: 'Low', value: history.filter(h => h.result?.priority === 'Low').length, color: '#22c55e' }
                          ].filter(d => d.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                        >
                          {[
                            { name: 'High', value: history.filter(h => h.result?.priority === 'High').length, color: '#ef4444' },
                            { name: 'Medium', value: history.filter(h => h.result?.priority === 'Medium').length, color: '#f59e0b' },
                            { name: 'Low', value: history.filter(h => h.result?.priority === 'Low').length, color: '#22c55e' }
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4 }} itemStyle={{ color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gap: 14, gridTemplateColumns: history.length > 0 ? '1fr 1fr' : '1fr 1fr 1fr' }}>
                {[
                  { t: 'Spectral Anomaly Detected', p: 'High',   b: 'High iron-oxide spectral signature detected in the target region. Recommend immediate field verification.' },
                  { t: 'Proximity Cluster Found',   p: 'Medium', b: 'Three exploration points within 5 km showing Medium+ prospectivity. Consider combined field survey.' },
                  { t: 'Coverage Gap',              p: 'Low',    b: 'Selected region has sparse prediction coverage. Additional sampling recommended.' },
                ].slice(0, history.length > 0 ? 2 : 3).map(r => (
                  <div key={r.t} className="card">
                    <div className="card-h"><span className="card-title">{r.t}</span><Badge priority={r.p} /></div>
                    <div className="card-b">
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 12 }}>{r.b}</p>
                      <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>View Details →</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="alert alert-warn" style={{ marginTop: 14 }}>
              <span>⚠</span>
              <span>AI recommendations are decision-support tools derived from statistical model outputs and do not confirm mineral deposits. Independent geological validation is required before any mining decisions.</span>
            </div>

            {history.length > 0 && (
              <div className="card" style={{ marginTop: 14 }}>
                <div className="card-h"><span className="card-title">Session Prediction Log</span></div>
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  <table className="tbl">
                    <thead><tr><th>Time</th><th>Coordinates</th><th>Region</th><th>Score</th><th>Priority</th></tr></thead>
                    <tbody>
                      {history.map(h => (
                        <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => { setMapLoc({ lat: h.lat, lng: h.lng }); setResult(h.result); setPage('explore'); }}>
                          <td style={{ color: 'var(--text-muted)' }}>{h.ts}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.lat.toFixed(3)}, {h.lng.toFixed(3)}</td>
                          <td>{h.result?.region_name?.split(' ')[0] || '—'}</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{h.result?.prospectivity_score !== undefined ? `${Math.round(h.result.prospectivity_score * 100)}%` : '—'}</td>
                          <td><Badge priority={h.result?.priority} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
