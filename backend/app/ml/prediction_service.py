import os
import joblib
import pandas as pd

class ManganEXPredictor:
    def __init__(self, model_dir: str):
        self.model_dir = model_dir
        self.model_path = os.path.join(model_dir, "rf_model.joblib")
        self.preprocessor_path = os.path.join(model_dir, "preprocessor.joblib")
        self.metadata_path = os.path.join(model_dir, "model_metadata.json")
        
        self.model = None
        self.preprocessor = None
        self.features_df = None
        
        self.load_model()

    def haversine(self, lat1, lon1, lat2, lon2):
        import numpy as np
        R = 6371.0 # Earth radius in kilometers
        phi1 = np.radians(lat1)
        phi2 = np.radians(lat2)
        delta_phi = np.radians(lat2 - lat1)
        delta_lambda = np.radians(lon2 - lon1)
        a = np.sin(delta_phi/2)**2 + np.cos(phi1) * np.cos(phi2) * np.sin(delta_lambda/2)**2
        c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
        return R * c

    def load_model(self):
        """Safely load the model and preprocessor if they exist."""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model file not found at {self.model_path}. Please run Phase 5 training.")
        if not os.path.exists(self.preprocessor_path):
            raise FileNotFoundError(f"Preprocessor not found at {self.preprocessor_path}.")
            
        self.model = joblib.load(self.model_path)
        self.preprocessor = joblib.load(self.preprocessor_path)
        
        # Load the feature dataset for nearest-neighbor lookup
        features_csv_path = os.path.join(os.path.dirname(self.model_dir), "data", "features", "features_X_real.csv")
        if os.path.exists(features_csv_path):
            self.features_df = pd.read_csv(features_csv_path)
        else:
            self.features_df = None

    def predict(self, input_data: dict) -> dict:
        """
        Predicts prospectivity based on input features.
        Input should be a dictionary matching the expected feature schema.
        """
        if self.model is None or self.preprocessor is None:
            raise RuntimeError("Model or preprocessor is not loaded.")

        distance_km = None
        is_fallback_features = False

        # Look up nearest features if latitude and longitude are provided
        if 'latitude' in input_data and 'longitude' in input_data and self.features_df is not None:
            import numpy as np
            lat = float(input_data['latitude'])
            lon = float(input_data['longitude'])
            
            distances = self.haversine(lat, lon, self.features_df['latitude'].values, self.features_df['longitude'].values)
            closest_idx = np.argmin(distances)
            distance_km = float(distances[closest_idx])
            closest_row = self.features_df.iloc[closest_idx].to_dict()
            
            if distance_km > 0.5:
                is_fallback_features = True
                
            # Use closest features
            df_input = pd.DataFrame([closest_row])
        else:
            # Convert input dictionary to DataFrame (single row)
            df_input = pd.DataFrame([input_data])
            
        # Drop latitude and longitude if they exist, as the model was trained without them
        cols_to_drop = [c for c in ['latitude', 'longitude'] if c in df_input.columns]
        if cols_to_drop:
            df_input = df_input.drop(columns=cols_to_drop)
        
        # Apply the preprocessor (scaling/encoding)
        try:
            X_processed = self.preprocessor.transform(df_input)
        except Exception as e:
            raise ValueError(f"Error during preprocessing: {str(e)}")

        # Make prediction
        prediction = self.model.predict(X_processed)[0]
        
        result = {
            "prediction": prediction,
            "status": "success",
            "distance_to_nearest_feature_km": distance_km,
            "is_fallback_features": is_fallback_features
        }
        
        # Add probabilities if the model supports it
        if hasattr(self.model, "predict_proba"):
            probabilities = self.model.predict_proba(X_processed)[0]
            classes = self.model.classes_
            prob_dict = {str(classes[i]): float(probabilities[i]) for i in range(len(classes))}
            result["probabilities"] = prob_dict

        return result
