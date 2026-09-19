import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const checkHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error("Health check failed:", error);
    throw error;
  }
};

export const checkModelStatus = async () => {
  try {
    const response = await api.get('/model/status');
    return response.data;
  } catch (error) {
    console.error("Model status check failed:", error);
    throw error;
  }
};

export const checkGeospatialStatus = async () => {
  try {
    const response = await api.get('/geospatial/status');
    return response.data;
  } catch (error) {
    console.error("Geospatial status check failed:", error);
    throw error;
  }
};

export const getPilotRegion = async () => {
  try {
    const response = await api.get('/geospatial/pilot-region');
    return response.data;
  } catch (error) {
    console.error("Pilot region fetch failed:", error);
    throw error;
  }
};

export const getForecastStatus = async () => {
  try {
    const response = await api.get('/forecast/status');
    return response.data;
  } catch (error) {
    console.error("Forecast status check failed:", error);
    throw error;
  }
};

export const generateForecast = async (years_ahead = 5) => {
  try {
    const response = await api.post('/forecast', { years_ahead });
    return response.data;
  } catch (error) {
    console.error("Forecast generation failed:", error);
    throw error;
  }
};

export const predictProspectivity = async (data) => {
  try {
    const response = await api.post('/predict', data);
    return response.data;
  } catch (error) {
    console.error("Prediction failed:", error);
    if (error.response && error.response.data && error.response.data.detail) {
      // FastAPI returns validation errors in the 'detail' field
      const detail = error.response.data.detail;
      if (Array.isArray(detail)) {
        // Format array of Pydantic validation errors
        throw new Error(detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(' | '));
      }
      throw new Error(detail);
    }
    throw new Error(error.message || "Failed to connect to the prediction service.");
  }
};

export default api;
