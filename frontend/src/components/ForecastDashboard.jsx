import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ReferenceLine, Cell
} from 'recharts';
import { getForecastStatus, generateForecast } from '../services/api';

const ForecastDashboard = () => {
  const [status, setStatus] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const statusRes = await getForecastStatus();
        setStatus(statusRes);
        if (statusRes.status === 'Online') {
          const forecastRes = await generateForecast(5);
          setData(forecastRes.data);
        }
      } catch (err) {
        setError("Failed to connect to the Forecasting Engine.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const historicalData = data.filter(d => !d.is_forecast);
  const forecastData = data.filter(d => d.is_forecast);
  const currentGap = historicalData.length > 0 ? historicalData[historicalData.length - 1].supply_gap_kt : 0;
  const futureGap = forecastData.length > 0 ? forecastData[forecastData.length - 1].supply_gap_kt : 0;

  const chartStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    color: 'var(--text-primary)',
  };

  const tooltipStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 12,
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320, gap: 12, color: 'var(--text-muted)' }}>
        <span className="spinner"></span>
        <span>Loading Forecasting Engine…</span>
      </div>
    );
  }

  if (error || status?.status === 'Error') {
    return (
      <div className="alert error">
        <span>⚠</span>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>Forecasting Engine Error</div>
          <div>{error || status?.detail}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Risk alert banner */}
      {currentGap > 0 && (
        <div className="alert error" style={{ padding: '14px 18px', borderRadius: 10 }}>
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>
              Production Shortfall Risk: HIGH — {currentGap > 0 ? Math.round((currentGap/10000)*100) : 0}%
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>A forecast indicates a potential {currentGap.toFixed(0)} T gap in the next period.</div>
          </div>
          <button className="btn btn-danger" style={{ fontSize: 11, padding: '5px 12px', flexShrink: 0 }}>View Risk Analysis</button>
        </div>
      )}

      {/* Warning */}
      <div className="alert warn">
        <span>⚠</span>
        <div>
          <strong>Demonstration Data Warning</strong>
          <div style={{ marginTop: 2, fontSize: 11 }}>{status?.disclaimer || "Forecasts are based on sample data and do not represent official economic projections."}</div>
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Planned', value: '10,000 T', sub: 'Prototype demo data', accent: 'green' },
          { label: 'AI Forecast', value: '8,420 T', sub: 'Prototype demo data', accent: 'blue' },
          { label: 'Potential Gap', value: `${currentGap > 0 ? currentGap.toFixed(0) : futureGap.toFixed(0)} T`, sub: 'Prototype demo data', accent: 'red' },
          { label: 'Confidence', value: '82%', sub: 'Prototype demo data', accent: 'purple' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.accent}`}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.accent}`}>{s.value}</div>
            <div className="stat-change" style={{ color: 'var(--text-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Production vs Demand */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Planned vs Actual Production</div>
              <div className="card-sub">Monthly production variance and AI forecast · Prototype demo data</div>
            </div>
          </div>
          <div className="card-body" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="year" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                <ReferenceLine
                  x={historicalData.length > 0 ? historicalData[historicalData.length - 1].year : 2024}
                  stroke="var(--text-muted)" strokeDasharray="4 4"
                />
                <Line type="monotone" dataKey="production_kt" name="Planned" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="demand_kt" name="Actual" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Supply Gap */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Potential Production Shortfall</div>
              <div className="card-sub">Supply gap analysis · Red = deficit, Green = surplus</div>
            </div>
          </div>
          <div className="card-body">
            {[
              { label: 'Planned', value: '10,000 T', color: 'var(--text-primary)' },
              { label: 'Expected', value: '8,420 T', color: 'var(--text-primary)' },
              { label: 'Potential Gap', value: `${currentGap > 0 ? currentGap.toFixed(0) : '1,580'} T`, color: 'var(--high-color)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</span>
              </div>
            ))}
            <div className="progress-bar" style={{ height: 8, marginTop: 16 }}>
              <div className="progress-fill green" style={{ width: '84%' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Coverage</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-green)' }}>84%</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ForecastDashboard;
