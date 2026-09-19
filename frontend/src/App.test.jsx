import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';
import * as api from './services/api';

// Mock the API calls
vi.mock('./services/api', () => ({
  checkHealth: vi.fn(),
  checkGeospatialStatus: vi.fn(),
  checkModelStatus: vi.fn(),
  getPilotRegion: vi.fn(),
  predictProspectivity: vi.fn(),
  getForecastStatus: vi.fn(),
  generateForecast: vi.fn()
}));

// Mock react-leaflet to prevent jsdom errors
vi.mock('react-leaflet', () => {
  return {
    MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
    TileLayer: () => <div data-testid="tile-layer" />,
    Marker: ({ children }) => <div data-testid="marker">{children}</div>,
    Popup: ({ children }) => <div data-testid="popup">{children}</div>,
    useMap: () => ({ setView: vi.fn() }),
    useMapEvents: () => ({}),
    LayersControl: Object.assign(({ children }) => <div data-testid="layers-control">{children}</div>, {
      BaseLayer: ({ children }) => <div data-testid="base-layer">{children}</div>,
      Overlay: ({ children }) => <div data-testid="overlay-layer">{children}</div>,
    }),
    Rectangle: ({ children }) => <div data-testid="rectangle">{children}</div>
  };
});

describe('App Component', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('renders loading state initially', () => {
    // Make promises that don't resolve immediately
    api.checkHealth.mockImplementation(() => new Promise(() => {}));
    api.checkGeospatialStatus.mockImplementation(() => new Promise(() => {}));
    api.checkModelStatus.mockImplementation(() => new Promise(() => {}));
    api.getPilotRegion.mockImplementation(() => new Promise(() => {}));
    
    render(<App />);
    expect(screen.getByText('Model: Checking...')).toBeInTheDocument();
    expect(screen.getByText('Geo Engine: Checking...')).toBeInTheDocument();
  });

  test('renders main dashboard after loading', async () => {
    api.checkHealth.mockResolvedValue({ status: "healthy", message: "ManganEX Backend is running" });
    api.checkGeospatialStatus.mockResolvedValue({ status: 'Online' });
    api.checkModelStatus.mockResolvedValue({ status: 'Online' });
    api.getPilotRegion.mockResolvedValue({ region_name: 'Test Region', bounding_box: { minx: 10, miny: 20, maxx: 30, maxy: 40 } });
    
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Model: Online')).toBeInTheDocument();
      expect(screen.getByText('Geo Engine: Online')).toBeInTheDocument();
      expect(screen.getByText('Backend: Online')).toBeInTheDocument();
      expect(screen.getByText(/Target: Test Region/i)).toBeInTheDocument();
    });
  });

  test('renders error state if initialization fails', async () => {
    api.checkHealth.mockRejectedValue(new Error('Network error'));
    api.checkGeospatialStatus.mockRejectedValue(new Error('Network error'));
    api.checkModelStatus.mockRejectedValue(new Error('Network error'));
    api.getPilotRegion.mockRejectedValue(new Error('Network error'));
    
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Model: Offline')).toBeInTheDocument();
      expect(screen.getByText('Geo Engine: Offline')).toBeInTheDocument();
      expect(screen.getByText('Backend: Offline')).toBeInTheDocument();
    });
  });
});
