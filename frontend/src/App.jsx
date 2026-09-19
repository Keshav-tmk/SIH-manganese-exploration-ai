import React, { useState, useEffect } from 'react';
import { checkHealth, predictProspectivity, checkModelStatus, checkGeospatialStatus, getPilotRegion } from './services/api';
import MapComponent from './components/MapComponent';
import ForecastDashboard from './components/ForecastDashboard';

function App() {
  const [activeTab, setActiveTab] = useState('explore'); // 'explore' or 'forecast'
  
  const [healthStatus, setHealthStatus] = useState('Checking...');
  const [modelStatus, setModelStatus] = useState('Checking...');
  const [geospatialStatus, setGeospatialStatus] = useState('Checking...');
  const [pilotRegion, setPilotRegion] = useState(null);
  
  const [formData, setFormData] = useState({
    latitude: '',
    longitude: '',
    elevation: '',
    slope: '',
    vegetation_index: '',
    geological_feature: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [mapLocation, setMapLocation] = useState(null);
  
  // Phase 7: History and Filtering
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    checkHealth()
      .then(res => setHealthStatus(`Online: ${res.message}`))
      .catch(() => setHealthStatus('Offline - Please start backend'));
      
    checkModelStatus()
      .then(res => setModelStatus(res.status))
      .catch(() => setModelStatus('Offline'));

    checkGeospatialStatus()
      .then(res => setGeospatialStatus(res.status))
      .catch(() => setGeospatialStatus('Offline'));
      
    getPilotRegion()
      .then(res => setPilotRegion(res))
      .catch(() => setPilotRegion(null));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMapClick = (lat, lng) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6)
    }));
    // Remove previous prediction and error when new location is clicked
    setPrediction(null);
    setError(null);
    setMapLocation({ lat, lng });
  };

  const handleReset = () => {
    setFormData({
      latitude: '',
      longitude: '',
      elevation: '',
      slope: '',
      vegetation_index: '',
      geological_feature: ''
    });
    setPrediction(null);
    setError(null);
    setMapLocation(null);
  };
  
  const handleClearHistory = () => {
    setHistory([]);
    setMapLocation(null);
    setPrediction(null);
  };
  
  const handleHistoryClick = (item) => {
    setMapLocation({ lat: item.lat, lng: item.lng });
    setPrediction(item.prediction);
    setFormData(prev => ({
      ...prev,
      latitude: item.lat.toFixed(6),
      longitude: item.lng.toFixed(6)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    
    if (isNaN(lat) || isNaN(lng)) {
      setError("Please provide valid numerical coordinates for Latitude and Longitude.");
      return;
    }
    if (lat < -90 || lat > 90) {
      setError("Latitude must be between -90 and 90.");
      return;
    }
    if (lng < -180 || lng > 180) {
      setError("Longitude must be between -180 and 180.");
      return;
    }

    setLoading(true);
    setError(null);
    setPrediction(null);
    
    // Update map immediately to show the location even before prediction returns
    setMapLocation({ lat, lng });

    try {
      // Clean up data for API
      const apiData = {
        latitude: lat,
        longitude: lng,
        elevation: formData.elevation ? parseFloat(formData.elevation) : undefined,
        slope: formData.slope ? parseFloat(formData.slope) : undefined,
        vegetation_index: formData.vegetation_index ? parseFloat(formData.vegetation_index) : undefined,
        geological_feature: formData.geological_feature || undefined
      };

      const result = await predictProspectivity(apiData);
      setPrediction(result);
      
      // Add to history
      setHistory(prev => [{
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        lat: lat,
        lng: lng,
        prediction: result
      }, ...prev]);
      
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to connect to prediction service.");
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(item => {
    if (filter === 'All') return true;
    return item.prediction?.priority === filter;
  });

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-slate-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">ManganEX</h1>
              <p className="mt-1 text-sm text-slate-300">AI-Powered Manganese Exploration & Supply Intelligence</p>
              {pilotRegion && (
                <p className="mt-2 text-xs font-semibold text-blue-300 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  Target: {pilotRegion.region_name}
                </p>
              )}
            </div>
            
            <div className="flex flex-col items-end gap-3">
              {/* Navigation Tabs */}
              <div className="bg-slate-700 p-1 rounded-lg inline-flex">
                <button
                  onClick={() => setActiveTab('explore')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'explore' 
                      ? 'bg-blue-600 text-white shadow' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-600'
                  }`}
                >
                  Exploration Map
                </button>
                <button
                  onClick={() => setActiveTab('forecast')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'forecast' 
                      ? 'bg-blue-600 text-white shadow' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-600'
                  }`}
                >
                  Supply Forecasting
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  healthStatus.includes('Online') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                }`}>
                  Backend: {healthStatus.includes('Online') ? 'Online' : 'Offline'}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  modelStatus.includes('Online') ? 'bg-indigo-500/20 text-indigo-300' : 'bg-orange-500/20 text-orange-300'
                }`}>
                  Model: {modelStatus}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  geospatialStatus.includes('Online') ? 'bg-cyan-500/20 text-cyan-300' : 
                  geospatialStatus.includes('Fallback') ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'
                }`}>
                  Geo Engine: {geospatialStatus}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        
        {activeTab === 'forecast' ? (
          <ForecastDashboard />
        ) : (
          <>
            {/* Demo Warning */}
        <div className="mb-8 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">Demonstration Mode</h3>
              <div className="mt-2 text-sm text-amber-700">
                <p>This is Phase 1 of the ManganEX platform. The predictions provided are generated using a temporary demonstration logic and should not be used as real geological discoveries. Scientific models will be integrated in subsequent phases.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Form Column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-slate-50">
                <h2 className="text-lg font-semibold text-gray-800">Target Coordinates</h2>
              </div>
              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="latitude" className="block text-sm font-medium text-gray-700">Latitude *</label>
                      <input
                        type="number"
                        step="any"
                        id="latitude"
                        name="latitude"
                        required
                        value={formData.latitude}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        placeholder="e.g. 21.12"
                      />
                    </div>
                    <div>
                      <label htmlFor="longitude" className="block text-sm font-medium text-gray-700">Longitude *</label>
                      <input
                        type="number"
                        step="any"
                        id="longitude"
                        name="longitude"
                        required
                        value={formData.longitude}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        placeholder="e.g. 79.45"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-100 mt-4">
                    <p className="text-xs text-gray-500 font-medium mb-3">Optional Terrain Features (For Phase 4+)</p>
                    
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="elevation" className="block text-xs font-medium text-gray-600">Elevation (m)</label>
                        <input
                          type="number"
                          step="any"
                          id="elevation"
                          name="elevation"
                          value={formData.elevation}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-1.5 border"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="slope" className="block text-xs font-medium text-gray-600">Slope (°)</label>
                          <input
                            type="number"
                            step="any"
                            id="slope"
                            name="slope"
                            value={formData.slope}
                            onChange={handleInputChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-1.5 border"
                          />
                        </div>
                        <div>
                          <label htmlFor="vegetation_index" className="block text-xs font-medium text-gray-600">NDVI</label>
                          <input
                            type="number"
                            step="any"
                            id="vegetation_index"
                            name="vegetation_index"
                            value={formData.vegetation_index}
                            onChange={handleInputChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-1.5 border"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="geological_feature" className="block text-xs font-medium text-gray-600">Geological Feature</label>
                        <select
                          id="geological_feature"
                          name="geological_feature"
                          value={formData.geological_feature}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-1.5 border bg-white"
                        >
                          <option value="">-- Select Feature --</option>
                          <option value="Basalt">Basalt</option>
                          <option value="Limestone">Limestone</option>
                          <option value="Sandstone">Sandstone</option>
                          <option value="Shale">Shale</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex space-x-3">
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={loading}
                      className="w-1/3 flex justify-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className={`w-2/3 flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                        loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                      } transition-colors`}
                    >
                      {loading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Analyzing Data...
                        </span>
                      ) : 'Predict Prospectivity'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Prediction Result Card */}
            {prediction && !loading && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden transform transition-all duration-300">
                <div className={`px-6 py-4 border-b ${
                  prediction.priority === 'High' ? 'bg-red-50 border-red-100' :
                  prediction.priority === 'Medium' ? 'bg-yellow-50 border-yellow-100' : 'bg-green-50 border-green-100'
                }`}>
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800">Analysis Results</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      prediction.priority === 'High' ? 'bg-red-200 text-red-800' :
                      prediction.priority === 'Medium' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'
                    }`}>
                      {prediction.priority} Priority
                    </span>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="flex flex-col items-center justify-center mb-6">
                    <span className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">Prospectivity Score</span>
                    <div className="flex items-end">
                      <span className="text-5xl font-black text-gray-800">{prediction.prospectivity_score}</span>
                      <span className="text-xl font-bold text-gray-400 mb-1 ml-1">/ 1.0</span>
                    </div>
                    <span className="text-xs text-gray-400 mt-2">Prediction: {prediction.prediction_label}</span>
                  </div>
                  
                  {prediction.probabilities && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 font-medium mb-2">Class Probabilities:</p>
                      <div className="space-y-2">
                        {Object.entries(prediction.probabilities).map(([label, prob]) => (
                          <div key={label} className="relative pt-1">
                            <div className="flex mb-1 items-center justify-between">
                              <div>
                                <span className="text-xs font-semibold inline-block text-gray-600">
                                  {label}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-semibold inline-block text-gray-600">
                                  {(prob * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                              <div style={{ width: `${prob * 100}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                                label === 'High' ? 'bg-red-500' : label === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                              }`}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 border border-gray-100">
                    <p><strong>Note:</strong> {prediction.explanation}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
            {/* Dashboard Statistics */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-slate-50">
                <h2 className="text-lg font-semibold text-gray-800">Dashboard Stats</h2>
              </div>
              <div className="p-6">
                <dl className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-100">
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Predictions</dt>
                    <dd className="mt-1 text-2xl font-semibold text-gray-900">{history.length}</dd>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-100">
                    <dt className="text-sm font-medium text-gray-500 truncate">Visible Markers</dt>
                    <dd className="mt-1 text-2xl font-semibold text-gray-900">{filteredHistory.length}</dd>
                  </div>
                  <div className="col-span-2 bg-blue-50 px-4 py-3 rounded-lg border border-blue-100">
                    <dt className="text-sm font-medium text-blue-800 truncate">Data Source Status</dt>
                    <dd className="mt-1 text-sm text-blue-900">Current dashboard results are based on sample/demo data.</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
          
          {/* Map Column */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Map Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">Filter Prospectivity:</span>
                <div className="flex space-x-2">
                  {['All', 'High', 'Medium', 'Low'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                        filter === f 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Map Component */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 h-[500px]">
              <MapComponent 
                activeLocation={mapLocation} 
                markers={filteredHistory} 
                onMapClick={handleMapClick}
                pilotRegion={pilotRegion}
              />
            </div>
            
            {/* Prediction History Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">Session History</h2>
                {history.length > 0 && (
                  <button 
                    onClick={handleClearHistory}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    Clear History
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coordinates</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">
                          No predictions made in this session yet.
                        </td>
                      </tr>
                    ) : (
                      history.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.timestamp}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                            {Number(item.lat).toFixed(4)}, {Number(item.lng).toFixed(4)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {item.prediction?.prospectivity_score}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              item.prediction?.priority === 'High' ? 'bg-red-100 text-red-700' :
                              item.prediction?.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {item.prediction?.priority || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button 
                              onClick={() => handleHistoryClick(item)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View Map
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
          </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
