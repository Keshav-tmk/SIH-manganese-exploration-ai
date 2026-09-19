# ManganEX – AI-Powered Manganese Exploration & Supply Intelligence

Welcome to **ManganEX**, a comprehensive AI and GIS-powered platform designed to identify potential manganese exploration zones and provide actionable supply-demand forecasting to aid strategic decision-making.

## 1. Project Overview
The identification of manganese exploration zones traditionally involves arduous manual analysis of satellite imagery, geological data, and terrain features. **ManganEX** solves this by automating spatial analysis, extracting critical features, and generating prospectivity predictions using Machine Learning. Furthermore, it integrates a sophisticated forecasting module to predict supply gaps years into the future.

Our initial pilot region is the **Sandur-Ballari (Bellary) Manganese Mineral Belt** in Karnataka, India.

## 2. Key Features
- **Interactive Geospatial Dashboard:** Clickable map interface (React-Leaflet) that automatically extracts coordinates for prospectivity querying.
- **AI-Powered Prospectivity Mapping:** Uses Random Forest models trained on structural geological features, vegetation indices, and terrain data to predict high-value zones.
- **Production & Demand Forecasting:** Real-time dashboards visualizing historical trends and future supply deficit/surplus gaps (currently driven by Scikit-Learn linear regression).
- **Geospatial Processing Engine:** Backend spatial processing utilizing `geopandas` and `rasterio`, built with resilient cross-platform (Windows/Linux) fallbacks for maximum compatibility.
- **Robust API Backend:** Built with FastAPI, featuring strict Pydantic validation and extensive test coverage.

## 3. Technology Stack
### Frontend
- React 18 & Vite
- Tailwind CSS (Styling & Responsiveness)
- React-Leaflet (Interactive Mapping)
- Recharts (Data Visualization)
- Vitest (Component Testing)

### Backend
- Python 3.9+
- FastAPI & Uvicorn (REST API)
- Scikit-Learn & Pandas (Machine Learning & Data Processing)
- GeoPandas, Rasterio, Shapely (Geospatial Pipelines)
- Pytest (Automated Testing)

---

## 4. Installation & Setup Instructions

### Prerequisites
- Node.js (v18+)
- Python (3.9+)

### A. Backend Setup
1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   - **Windows:** `python -m venv venv` and `.\venv\Scripts\activate`
   - **Mac/Linux:** `python3 -m venv venv` and `source venv/bin/activate`
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up Environment Variables:
   - Copy `.env.example` to `.env` and adjust the variables (e.g. `PORT=8000`).

### B. Frontend Setup
1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Set up Environment Variables:
   - Copy `.env.example` to `.env`. Ensure `VITE_API_URL` points to your backend (default is `http://localhost:8000/api`).

---

## 5. How to Run the Project

1. **Start the Backend Server:**
   Ensure your virtual environment is active, then run:
   ```bash
   uvicorn app.main:app --reload
   ```
   *The backend will be available at `http://localhost:8000`.*

2. **Start the Frontend Application:**
   ```bash
   npm run dev
   ```
   *The frontend will be available at `http://localhost:5173`.*

---

## 6. Testing

- **Backend (Pytest):**
  Navigate to `backend/`, activate your venv, and run:
  ```bash
  pytest app/
  ```
- **Frontend (Vitest):**
  Navigate to `frontend/` and run:
  ```bash
  npm run test
  ```
- **Frontend Build (Production Check):**
  ```bash
  npm run build
  ```

---

## 7. API Documentation (Key Endpoints)
FastAPI automatically generates interactive Swagger documentation. When the backend is running, visit: **`http://localhost:8000/docs`**

- `GET /api/health`: Health status of the backend.
- `POST /api/predict`: Returns a prospectivity prediction (requires lat, lon, elevation, slope).
- `GET /api/forecast/status`: Retrieves the health and MAE metrics of the forecasting model.
- `POST /api/forecast`: Generates a continuous timeline of historical and forecasted supply/demand data.
- `GET /api/geospatial/pilot-region`: Returns bounding box definitions for the Sandur-Ballari pilot zone.

---

## 8. Limitations & Future Improvements
> **⚠️ DEMONSTRATION MODE:** Currently, predictions and forecasts utilize demonstration logic and synthetic samples designed to validate the architectural pipeline. **They are not scientifically verified geological discoveries or official economic projections.**

**Future Roadmap:**
- **Full Data Integration:** Ingest actual ISRO Bhuvan DEMs and Sentinel-2 L2A imagery instead of relying on structural fallbacks.
- **Deep Learning Pipelines:** Upgrade from Random Forest / Linear Regression to advanced neural networks (e.g., CNNs for satellite imagery).
- **Dockerization:** Containerize both the backend and frontend using Docker for seamless cloud deployment on AWS or GCP.
- **Authentication:** Add user authentication for enterprise access to sensitive geospatial datasets.

---
*Built as a Phase 12 Final Delivery for AI-Powered Manganese Mineral Prospectivity Mapping.*
