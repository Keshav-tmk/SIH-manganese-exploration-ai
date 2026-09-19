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
          const forecastRes = await generateForecast(5); // 5 years ahead
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-blue-600 font-medium">Loading Forecasting Engine...</span>
      </div>
    );
  }

  if (error || status?.status === 'Error') {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
        <h3 className="text-sm font-medium text-red-800">Forecasting Engine Error</h3>
        <p className="mt-1 text-sm text-red-700">{error || status?.detail}</p>
      </div>
    );
  }

  // Calculate current metrics from data
  const historicalData = data.filter(d => !d.is_forecast);
  const forecastData = data.filter(d => d.is_forecast);
  
  const currentGap = historicalData.length > 0 ? historicalData[historicalData.length - 1].supply_gap_kt : 0;
  const futureGap = forecastData.length > 0 ? forecastData[forecastData.length - 1].supply_gap_kt : 0;

  return (
    <div className="space-y-6">
      
      {/* Disclaimer */}
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md shadow-sm">
        <div className="flex items-start">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-bold text-amber-800">Demonstration Data Warning</h3>
            <div className="mt-1 text-sm text-amber-700">
              <p>{status?.disclaimer || "Forecasts are based on sample data and do not represent official economic projections."}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Model Type</h4>
          <p className="mt-2 text-lg font-bold text-gray-900">{status?.model_type || "N/A"}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Model MAE</h4>
          <div className="mt-2 flex space-x-4">
            <div>
              <span className="text-xs text-gray-400">Prod:</span>
              <span className="ml-1 text-lg font-bold text-gray-900">{status?.metrics?.production?.mae.toFixed(1)} kt</span>
            </div>
            <div>
              <span className="text-xs text-gray-400">Demand:</span>
              <span className="ml-1 text-lg font-bold text-gray-900">{status?.metrics?.demand?.mae.toFixed(1)} kt</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Current Supply Gap</h4>
          <p className={`mt-2 text-2xl font-bold ${currentGap > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {currentGap > 0 ? '+' : ''}{currentGap.toFixed(1)} kt
          </p>
          <p className="text-xs text-gray-400">Latest Historical Year</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Projected Supply Gap</h4>
          <p className={`mt-2 text-2xl font-bold ${futureGap > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {futureGap > 0 ? '+' : ''}{futureGap.toFixed(1)} kt
          </p>
          <p className="text-xs text-gray-400">5 Years Ahead</p>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Production vs Demand Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Production vs. Demand Trend</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="year" tick={{fill: '#6b7280'}} />
                <YAxis tick={{fill: '#6b7280'}} label={{ value: 'Kilotonnes (kt)', angle: -90, position: 'insideLeft', style: {textAnchor: 'middle', fill: '#6b7280'} }} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'}}
                  labelStyle={{fontWeight: 'bold', color: '#374151'}}
                />
                <Legend />
                <ReferenceLine x={historicalData.length > 0 ? historicalData[historicalData.length - 1].year : 2024} stroke="#9ca3af" strokeDasharray="3 3" label={{ position: 'top', value: 'Forecast Start', fill: '#9ca3af', fontSize: 12 }} />
                <Line type="monotone" dataKey="production_kt" name="Production" stroke="#3b82f6" strokeWidth={3} dot={{r: 3}} activeDot={{r: 5}} />
                <Line type="monotone" dataKey="demand_kt" name="Demand" stroke="#ef4444" strokeWidth={3} dot={{r: 3}} activeDot={{r: 5}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Supply Gap Analysis */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Supply Gap Analysis (Demand - Production)</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="year" tick={{fill: '#6b7280'}} />
                <YAxis tick={{fill: '#6b7280'}} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'}}
                  cursor={{fill: '#f3f4f6'}}
                />
                <ReferenceLine y={0} stroke="#000" />
                <ReferenceLine x={historicalData.length > 0 ? historicalData[historicalData.length - 1].year : 2024} stroke="#9ca3af" strokeDasharray="3 3" />
                <Bar dataKey="supply_gap_kt" name="Supply Gap (Deficit > 0)" radius={[4, 4, 0, 0]}>
                  {
                    data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.supply_gap_kt > 0 ? '#ef4444' : '#22c55e'} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-4 text-xs text-gray-500 text-center">
            * Positive values (Red) indicate a supply deficit. Negative values (Green) indicate a supply surplus.
          </p>
        </div>
      </div>
      
    </div>
  );
};

export default ForecastDashboard;
