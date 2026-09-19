# Phase 10: Production and Demand Forecasting

## Objective
To implement a supply intelligence forecasting module that predicts future manganese production and demand, calculating potential supply gaps.

## Components Implemented

### 1. Data Pipeline
- Created a demonstration dataset (`data/demo_supply_demand.csv`) to validate the pipeline architecture without fabricating real-world data.

### 2. Backend Forecasting Module (`forecaster.py`)
- Implemented `ManganeseForecaster` using `scikit-learn`.
- Performs data cleaning, dropping NaNs and duplicates.
- Uses `LinearRegression` as the baseline model.
- Includes train/test splitting for evaluating Mean Absolute Error (MAE), Root Mean Squared Error (RMSE), and Mean Absolute Percentage Error (MAPE).
- Calculates the "Supply Gap" (`Demand - Production`).

### 3. FastAPI Endpoints
- `GET /api/forecast/status`: Returns module health, data points loaded, evaluation metrics, and disclaimer information.
- `POST /api/forecast`: Accepts `years_ahead` and returns a merged timeline of historical data and future projections.

### 4. React Frontend (`ForecastDashboard.jsx`)
- Built a new tab in the `App.jsx` interface for Supply Forecasting.
- Integrated `recharts` to render a Production vs. Demand line chart and a Supply Gap bar chart.
- Included visible disclaimers clarifying that the dashboard uses demonstration data for structural validation.

## Future Enhancements (Post-Phase 12)
- Replace demonstration data with real historical data (e.g., from IBM or USGS) if available and properly licensed.
- Integrate advanced time-series models (e.g., ARIMA or Prophet) instead of basic Linear Regression.
- Add external economic indicators (GDP growth, steel production) as features in the regression model.
