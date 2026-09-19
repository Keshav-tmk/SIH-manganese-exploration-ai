import React, { useState, useEffect } from 'react';
import { checkHealth, predictProspectivity, predictMultiRegion, checkModelStatus, checkGeospatialStatus, getPilotRegion } from './services/api';
import MapComponent from './components/MapComponent';
import Visualization3D from './components/Visualization3D';
import ForecastDashboard from './components/ForecastDashboard';
import RegionSelector from './components/RegionSelector';

function App() {
  const [activeTab, setActiveTab] = useState('explore'); // 'explore' or 'forecast'
  
  const [healthStatus, setHealthStatus] = useState('Checking...');
  const [modelStatus, setModelStatus] = useState('Checking...');
  const [geospatialStatus, setGeospatialStatus] = useState('Checking...');
  const [pilotRegion, setPilotRegion] = useState(null);
  
  const [formData, setFormData] = useState({
    latitude: '',
    longitude: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [mapLocation, setMapLocation] = useState(null);
  
  // Phase 16: Prediction mode and region selector
  const [predictionMode, setPredictionMode] = useState('single'); // 'single' | 'multiregion'
  const [selectedRegionKey, setSelectedRegionKey] = useState(null);

  // Phase 7: History and Filtering
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState('All');

  // Phase 17: 3D Visualization and Layer Toggles
  const [viewMode, setViewMode] = useState('2d'); // '2d' | '3d'
  const [showElevation, setShowElevation] = useState(false);
  const [showGeology, setShowGeology] = useState(false);

  // Phase 18: Layer integration warnings
  const [layerWarning, setLayerWarning] = useState(null);

  const handleLayerUnavailable = (layerName) => {
    setLayerWarning(layerName);
    setTimeout(() => {
      setLayerWarning(null);
    }, 5000);
  };

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
    // In multi-region mode, clear the region selector when clicking freely
    if (predictionMode === 'multiregion') setSelectedRegionKey(null);
  };

  const handleReset = () => {
    setFormData({ latitude: '', longitude: '' });
    setPrediction(null);
    setError(null);
    setMapLocation(null);
    setSelectedRegionKey(null);
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
      const apiData = { latitude: lat, longitude: lng };
      let result;

      if (predictionMode === 'multiregion') {
        // Phase 16: use the Phase 15 multi-region model
        result = await predictMultiRegion(apiData);
      } else {
        // Phase 12: use the single-region model (existing behaviour)
        result = await predictProspectivity(apiData);
      }

      setPrediction(result);
      
      // Add to history
      setHistory(prev => [{
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        lat: lat,
        lng: lng,
        prediction: result,
        mode: predictionMode,
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
        {/* Welcome and Demo Information Banner */}
        <div className="mb-8 bg-white border border-blue-200 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-blue-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white flex items-center">
              <svg className="h-6 w-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Welcome to the ManganEX Live Demonstration
            </h2>
          </div>
          <div className="p-6">
            <p className="text-gray-700 mb-6">
              ManganEX uses a Random Forest Machine Learning pipeline powered by Sentinel-2 spectral features (B2, B3, B4, B8, B11, B12, NDVI) and SRTM topography data mapped against confirmed Indian manganese deposits. This demo showcases the <strong>Phase 15 LORO-validated model</strong> across multiple geological belts.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Application Workflow */}
              <div className="bg-gray-50 p-4 rounded border border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center mr-2 text-xs font-mono">1</span>
                  Workflow
                </h3>
                <ul className="text-sm text-gray-600 space-y-2 list-disc pl-4">
                  <li>Select <strong>Phase 15 Multi-Region</strong> mode.</li>
                  <li>Choose one of the supported <strong>Manganese Belts</strong> from the dropdown.</li>
                  <li><strong>Click on the map</strong> to specify a coordinate, or enter it manually.</li>
                  <li>Click <strong>Predict</strong> to analyze the spectral signature.</li>
                </ul>
              </div>

              {/* Supported Regions */}
              <div className="bg-gray-50 p-4 rounded border border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center">
                  <span className="bg-indigo-100 text-indigo-800 rounded-full w-5 h-5 flex items-center justify-center mr-2 text-xs font-mono">2</span>
                  Supported Regions
                </h3>
                <p className="text-xs text-gray-500 mb-2">Predictions are currently validated for these Indian belts:</p>
                <div className="flex flex-wrap gap-1">
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-100">Jamda-Koira</span>
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-100">MOIL</span>
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-100">Sausar</span>
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-100">Shimoga</span>
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-100">Vizianagaram</span>
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-100">Banswara</span>
                </div>
              </div>

              {/* Prediction Score */}
              <div className="bg-gray-50 p-4 rounded border border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center">
                  <span className="bg-green-100 text-green-800 rounded-full w-5 h-5 flex items-center justify-center mr-2 text-xs font-mono">3</span>
                  Interpreting Scores
                </h3>
                <p className="text-xs text-gray-600 mb-2">
                  The model returns a <strong>Prospectivity Score (0.0 to 1.0)</strong> indicating the probability of manganese mineralization based on surface signatures.
                </p>
                <ul className="text-xs space-y-1">
                  <li><span className="font-semibold text-red-600">High (&gt; 0.7):</span> Strong spectral correlation.</li>
                  <li><span className="font-semibold text-yellow-600">Medium (0.4 - 0.7):</span> Mixed indicators.</li>
                  <li><span className="font-semibold text-green-600">Low (&lt; 0.4):</span> Unlikely to host deposits.</li>
                </ul>
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
              <div className="p-6 space-y-4">

                {/* Phase 16: Model selection toggle */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Prediction Model</p>
                  <div className="flex rounded-md border border-gray-200 overflow-hidden">
                    <button
                      id="mode-single"
                      type="button"
                      onClick={() => { setPredictionMode('single'); setSelectedRegionKey(null); setPrediction(null); }}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                        predictionMode === 'single'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Single-Region
                    </button>
                    <button
                      id="mode-multiregion"
                      type="button"
                      onClick={() => { setPredictionMode('multiregion'); setPrediction(null); }}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors border-l border-gray-200 ${
                        predictionMode === 'multiregion'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Phase 15 Multi-Region
                    </button>
                  </div>
                  {predictionMode === 'multiregion' && (
                    <p className="mt-1.5 text-[11px] text-indigo-600">Using the Phase 15 LORO-validated model across 6 manganese belts.</p>
                  )}
                </div>

                {/* Phase 16: Region Selector — only visible in multi-region mode */}
                {predictionMode === 'multiregion' && (
                  <RegionSelector
                    selectedKey={selectedRegionKey}
                    onSelectRegion={(info) => {
                      if (!info) {
                        setSelectedRegionKey(null);
                        return;
                      }
                      setSelectedRegionKey(info.regionKey);
                      setFormData(prev => ({
                        ...prev,
                        latitude: String(info.lat),
                        longitude: String(info.lon),
                      }));
                      setMapLocation({ lat: info.lat, lng: info.lon });
                      setPrediction(null);
                    }}
                  />
                )}

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

                  <div className="pt-2 flex space-x-3">
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
                      id="predict-btn"
                      disabled={loading}
                      className={`w-2/3 flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                        loading
                          ? 'bg-blue-400 cursor-not-allowed'
                          : predictionMode === 'multiregion'
                            ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                            : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors`}
                    >
                      {loading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Analyzing...
                        </span>
                      ) : predictionMode === 'multiregion' ? 'Multi-Region Predict' : 'Predict Prospectivity'}
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
            
            {/* Phase 16: Unsupported-region warning */}
            {prediction && !loading && prediction.is_validated_region === false && (
              <div id="unsupported-region-warning" className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-md shadow-sm">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-orange-800">Outside Supported Region</h3>
                    <p className="mt-1 text-xs text-orange-700">{prediction.message}</p>
                    <p className="mt-1 text-xs text-orange-600">Use the Region Selector to choose one of the 6 supported belts.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Prediction Result Card */}
            {prediction && !loading && prediction.is_validated_region !== false && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden transform transition-all duration-300">
                <div className={`px-6 py-4 border-b ${
                  prediction.priority === 'High' ? 'bg-red-50 border-red-100' :
                  prediction.priority === 'Medium' ? 'bg-yellow-50 border-yellow-100' : 'bg-green-50 border-green-100'
                }`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">Analysis Results</h2>
                      {/* Phase 16: Region badge */}
                      {prediction.region_name && (
                        <p id="result-region-badge" className="text-xs text-indigo-600 font-semibold mt-0.5">
                          📍 {prediction.region_name}{prediction.state ? `, ${prediction.state}` : ''}
                        </p>
                      )}
                    </div>
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
                    {/* Phase 16: nearest deposit info */}
                    {prediction.nearest_deposit_name && (
                      <span className="text-xs text-indigo-500 mt-1">
                        Nearest deposit: {prediction.nearest_deposit_name} ({prediction.nearest_deposit_dist_km} km)
                      </span>
                    )}
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

                  {/* Phase 19: Model Explainability */}
                  {prediction.explainability && (
                    <div className="mb-4 pt-4 border-t border-gray-100">
                      <div className="flex justify-between items-end mb-2">
                        <p className="text-xs text-gray-500 font-medium">Model Explainability:</p>
                        <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                          Top Features (Relative Importance)
                        </span>
                      </div>
                      <div className="space-y-3">
                        {prediction.explainability.feature_importance.slice(0, 5).map((fi, idx) => (
                          <div key={idx} className="relative">
                            <div className="flex mb-1 items-center justify-between">
                              <div>
                                <span className="text-xs font-semibold inline-block text-gray-700">
                                  {fi.feature}
                                </span>
                                <span className="text-[10px] text-gray-400 ml-2 font-mono">
                                  Val: {prediction.explainability.input_features[fi.feature]?.toFixed(4)}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-bold inline-block text-indigo-600">
                                  {(fi.importance * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            <div className="overflow-hidden h-1.5 text-xs flex rounded bg-indigo-50">
                              <div style={{ width: `${fi.importance * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-400"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 bg-indigo-50/50 p-2 rounded border border-indigo-100/50">
                        <p className="text-[10px] text-indigo-700/80 leading-tight">
                          <span className="font-semibold">Disclaimer:</span> Feature importance describes mathematical model behavior and does not prove geological causation.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 border border-gray-100 space-y-1">
                    <p><strong>Note:</strong> {prediction.explanation || prediction.disclaimer?.slice(0, 120)}</p>
                    {/* Phase 16: model metadata */}
                    {prediction.model_phase && (
                      <p className="text-xs text-gray-400">
                        Model: {prediction.model_phase} &mdash; {prediction.data_source}
                      </p>
                    )}
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
                    <dd className="mt-1 text-sm text-blue-900">Current dashboard results are based on real spectral signatures from Sentinel-2 and known deposit locations.</dd>
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
              <div className="flex items-center space-x-4 border-l border-gray-200 pl-4">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode('2d')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                      viewMode === '2d' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    2D Map
                  </button>
                  <button
                    onClick={() => setViewMode('3d')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                      viewMode === '3d' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    3D Visualization
                  </button>
                </div>
              </div>
              {viewMode === '3d' && (
                <div className="flex items-center space-x-2 border-l border-gray-200 pl-4">
                  <span className="text-xs text-gray-500">Layers:</span>
                  <button
                    onClick={() => setShowElevation(!showElevation)}
                    className={`px-2 py-1 rounded text-xs font-medium border ${showElevation ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600'}`}
                  >
                    Elevation
                  </button>
                  <button
                    onClick={() => setShowGeology(!showGeology)}
                    className={`px-2 py-1 rounded text-xs font-medium border ${showGeology ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-600'}`}
                  >
                    Geology
                  </button>
                </div>
              )}
            </div>

            {/* Map Component / 3D Visualization */}
            <div className="relative bg-white rounded-xl shadow-sm border border-gray-200 p-2 h-[500px]">
              
              {/* Layer Warning Toast */}
              {layerWarning && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-orange-100 border border-orange-300 text-orange-800 px-4 py-2 rounded-md shadow-lg flex items-center space-x-2 transition-opacity duration-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm font-semibold">
                    Real {layerWarning} data is currently unavailable. 
                  </span>
                </div>
              )}

              {viewMode === '2d' ? (
                <MapComponent 
                  activeLocation={mapLocation} 
                  markers={filteredHistory} 
                  onMapClick={handleMapClick}
                  onLayerUnavailable={handleLayerUnavailable}
                  pilotRegion={pilotRegion}
                  showRegionBboxes={predictionMode === 'multiregion'}
                  highlightedRegionKey={selectedRegionKey}
                />
              ) : (
                <Visualization3D
                  activeLocation={mapLocation}
                  markers={filteredHistory}
                  predictionMode={predictionMode}
                  showElevation={showElevation}
                  showGeology={showGeology}
                />
              )}
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
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
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
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                            {item.prediction?.region_name
                              ? <span className="text-indigo-600 font-medium">{item.prediction.state || item.prediction.region_name}</span>
                              : <span className="text-gray-400">Single-Region</span>
                            }
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
