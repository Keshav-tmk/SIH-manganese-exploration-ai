import os
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

class ManganeseForecaster:
    def __init__(self, data_path=None):
        if data_path is None:
            self.data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'demo_supply_demand.csv'))
        else:
            self.data_path = data_path
        self.df = None
        self.model_prod = None
        self.model_demand = None

    def load_and_clean_data(self):
        """Loads data from CSV and performs basic validation/cleaning."""
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"Dataset not found at {self.data_path}")
            
        self.df = pd.read_csv(self.data_path)
        
        # Validation checks
        required_cols = ['year', 'production_kt', 'demand_kt']
        missing_cols = [c for c in required_cols if c not in self.df.columns]
        if missing_cols:
            raise ValueError(f"Missing required columns: {missing_cols}")
            
        # Clean data
        self.df = self.df.dropna(subset=required_cols)
        self.df = self.df.drop_duplicates(subset=['year'])
        self.df = self.df.sort_values(by='year').reset_index(drop=True)
        
        # Ensure correct types
        self.df['year'] = self.df['year'].astype(int)
        self.df['production_kt'] = pd.to_numeric(self.df['production_kt'], errors='coerce')
        self.df['demand_kt'] = pd.to_numeric(self.df['demand_kt'], errors='coerce')
        
        # Drop coerced NaNs
        self.df = self.df.dropna(subset=required_cols)

    def train_models(self):
        """Trains linear regression baseline models for production and demand."""
        if self.df is None or self.df.empty:
            raise ValueError("Data not loaded or is empty.")
            
        X = self.df[['year']].values
        y_prod = self.df['production_kt'].values
        y_demand = self.df['demand_kt'].values
        
        self.model_prod = LinearRegression()
        self.model_prod.fit(X, y_prod)
        
        self.model_demand = LinearRegression()
        self.model_demand.fit(X, y_demand)

    def evaluate_models(self):
        """Chronological train/test split to evaluate baseline performance."""
        if self.df is None or len(self.df) < 5:
            return {"error": "Not enough data for meaningful evaluation."}
            
        # Split: last 3 years for testing, rest for training
        split_idx = len(self.df) - 3
        train_df = self.df.iloc[:split_idx]
        test_df = self.df.iloc[split_idx:]
        
        X_train = train_df[['year']].values
        y_train_prod = train_df['production_kt'].values
        y_train_demand = train_df['demand_kt'].values
        
        X_test = test_df[['year']].values
        y_test_prod = test_df['production_kt'].values
        y_test_demand = test_df['demand_kt'].values
        
        # Train temporary models
        m_prod = LinearRegression().fit(X_train, y_train_prod)
        m_demand = LinearRegression().fit(X_train, y_train_demand)
        
        # Predict on test set
        pred_prod = m_prod.predict(X_test)
        pred_demand = m_demand.predict(X_test)
        
        metrics = {
            "production": {
                "mae": float(mean_absolute_error(y_test_prod, pred_prod)),
                "rmse": float(np.sqrt(mean_squared_error(y_test_prod, pred_prod)))
            },
            "demand": {
                "mae": float(mean_absolute_error(y_test_demand, pred_demand)),
                "rmse": float(np.sqrt(mean_squared_error(y_test_demand, pred_demand)))
            }
        }
        
        def safe_mape(y_true, y_pred):
            mask = y_true != 0
            if not np.any(mask):
                return 0.0
            return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)
            
        metrics["production"]["mape"] = safe_mape(y_test_prod, pred_prod)
        metrics["demand"]["mape"] = safe_mape(y_test_demand, pred_demand)
        
        return metrics

    def forecast_future(self, years_ahead=5):
        """Generates forecasts for future years."""
        if self.model_prod is None or self.model_demand is None:
            raise ValueError("Models not trained.")
            
        last_year = int(self.df['year'].max())
        future_years = np.array(range(last_year + 1, last_year + 1 + years_ahead)).reshape(-1, 1)
        
        pred_prod = self.model_prod.predict(future_years)
        pred_demand = self.model_demand.predict(future_years)
        
        forecasts = []
        for i, year in enumerate(future_years.flatten()):
            p = max(0, pred_prod[i]) # Don't allow negative production
            d = max(0, pred_demand[i])
            forecasts.append({
                "year": int(year),
                "production_kt": round(p, 2),
                "demand_kt": round(d, 2),
                "supply_gap_kt": round(d - p, 2),
                "is_forecast": True
            })
            
        return forecasts

    def get_historical_data(self):
        """Returns historical data with computed supply gap."""
        if self.df is None:
            return []
            
        history = []
        for _, row in self.df.iterrows():
            p = row['production_kt']
            d = row['demand_kt']
            history.append({
                "year": int(row['year']),
                "production_kt": p,
                "demand_kt": d,
                "supply_gap_kt": round(d - p, 2),
                "is_forecast": False
            })
        return history
