import React, { useState, useEffect } from 'react';

/**
 * StateSearch — searches /api/geospatial/state-deposits?state=<name>
 * Displays region names, deposit names and coordinates.
 * Fires onDepositClick(lat, lon) so parent can navigate to Exploration Map.
 */
const StateSearch = ({ onDepositClick }) => {
  const [query, setQuery]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState(null);   // null = not searched yet
  const [error, setError]       = useState(null);
  const [searched, setSearched] = useState('');

  // ── Core fetch ──────────────────────────────────────────────────
  const doSearch = async (name) => {
    const q = name.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setSearched(q);
    try {
      // VITE_API_URL is typically "http://localhost:8000/api"
      // state-deposits endpoint is at /api/geospatial/state-deposits
      const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api');
      const url  = `${base}/geospatial/state-deposits?state=${encodeURIComponent(q)}`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      const rawResults = data.data || [];
      const priorityVal = { 'High': 3, 'Medium': 2, 'Low': 1 };
      
      const sortedResults = rawResults.map(region => {
        if (region.deposits) {
          region.deposits.sort((a, b) => {
            const pa = priorityVal[a.priority] || 0;
            const pb = priorityVal[b.priority] || 0;
            if (pa !== pb) return pb - pa;
            return (b.score || 0) - (a.score || 0);
          });
        }
        return region;
      });

      setResults(sortedResults);
    } catch (err) {
      setError(err.message || 'Connection failed — make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => { e.preventDefault(); doSearch(query); };

  // Listen for quick-access custom events from parent
  useEffect(() => {
    const handler = (e) => {
      setQuery(e.detail);
      doSearch(e.detail);
    };
    window.addEventListener('stateSearch', handler);
    return () => window.removeEventListener('stateSearch', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Search input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          className="fc"
          style={{ flex: 1 }}
          placeholder="e.g. Karnataka, Odisha, Goa…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !query.trim()}
          style={{ flexShrink: 0 }}
        >
          {loading
            ? <><span className="spin" style={{ width: 13, height: 13 }} /></>
            : <>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
                </svg>
                Search
              </>
          }
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="alert alert-error">
          <span>⚠</span>
          <div>
            <strong>Error:</strong> {error}
            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>
              Check that the backend is running on port 8000.
            </div>
          </div>
        </div>
      )}

      {/* No results */}
      {results !== null && results.length === 0 && !loading && (
        <div className="alert alert-warn">
          <span>🔍</span>
          <div>
            No manganese regions found for <strong>"{searched}"</strong>.
            <div style={{ marginTop: 4, fontSize: 11 }}>
              Supported: Karnataka, Maharashtra, Madhya Pradesh, Odisha, Goa, Andhra Pradesh
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="ss-results fade-up">
          {results.map(region => (
            <div key={region.region_key} className="card">
              <div className="card-h">
                <div>
                  <div className="card-title">{region.region_name}</div>
                  <div className="card-sub">
                    <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{region.state}</span>
                    {' · '}{region.deposits?.length || 0} known ore locations
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: 'var(--accent-green-dim)', color: 'var(--accent-green)',
                  border: '1px solid rgba(0,208,132,0.25)', textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>Active Belt</span>
              </div>

              {/* Deposits */}
              {region.deposits && region.deposits.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ paddingLeft: 16 }}>#</th>
                        <th>Deposit / Location</th>
                        <th>Priority</th>
                        <th>Score</th>
                        <th>Latitude</th>
                        <th>Longitude</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {region.deposits.map((dep, i) => {
                        const pColor = dep.priority === 'High' ? 'var(--accent-red)' : dep.priority === 'Medium' ? 'var(--accent-yellow)' : 'var(--accent-green)';
                        return (
                          <tr
                            key={i}
                            style={{ cursor: 'pointer' }}
                            onClick={() => onDepositClick && onDepositClick(dep.lat, dep.lon)}
                          >
                            <td style={{ paddingLeft: 16, color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: pColor, flexShrink: 0, display: 'inline-block' }}></span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dep.name}</span>
                              </div>
                            </td>
                            <td>
                              <span style={{
                                fontSize: 11, fontWeight: 700, color: pColor,
                                background: `${pColor}22`, padding: '2px 6px', borderRadius: 4
                              }}>
                                {dep.priority || 'Medium'}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                              {dep.prospectivity_score ? `${Math.round(dep.prospectivity_score * 100)}%` : '—'}
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                              {typeof dep.lat === 'number' ? dep.lat.toFixed(4) : dep.lat}°N
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                              {typeof dep.lon === 'number' ? dep.lon.toFixed(4) : dep.lon}°E
                            </td>
                            <td>
                              <button
                                className="btn btn-ghost"
                                style={{ fontSize: 11, padding: '3px 9px' }}
                                onClick={e => { e.stopPropagation(); onDepositClick && onDepositClick(dep.lat, dep.lon); }}
                              >
                                Explore →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StateSearch;
