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
        
        self.load_model()

    def load_model(self):
        """Safely load the model and preprocessor if they exist."""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model file not found at {self.model_path}. Please run Phase 5 training.")
        if not os.path.exists(self.preprocessor_path):
            raise FileNotFoundError(f"Preprocessor not found at {self.preprocessor_path}.")
            
        self.model = joblib.load(self.model_path)
        self.preprocessor = joblib.load(self.preprocessor_path)

    def predict(self, input_data: dict) -> dict:
        """
        Predicts prospectivity based on input features.
        Input should be a dictionary matching the expected feature schema.
        """
        if self.model is None or self.preprocessor is None:
            raise RuntimeError("Model or preprocessor is not loaded.")

        # Convert input dictionary to DataFrame (single row)
        df_input = pd.DataFrame([input_data])
        
        # Ensure the required features for preprocessing exist
        required_raw_features = ['elevation', 'slope', 'vegetation_index', 'geological_feature']
        missing_features = [f for f in required_raw_features if f not in df_input.columns]
        
        if missing_features:
            raise ValueError(f"Input data is missing required features: {missing_features}")

        # Keep only the features that the preprocessor expects
        df_input = df_input[required_raw_features]
        
        # Apply the preprocessor (scaling/encoding)
        try:
            X_processed = self.preprocessor.transform(df_input)
        except Exception as e:
            raise ValueError(f"Error during preprocessing: {str(e)}")

        # Make prediction
        prediction = self.model.predict(X_processed)[0]
        
        result = {
            "prediction": prediction,
            "status": "success"
        }
        
        # Add probabilities if the model supports it
        if hasattr(self.model, "predict_proba"):
            probabilities = self.model.predict_proba(X_processed)[0]
            classes = self.model.classes_
            prob_dict = {str(classes[i]): float(probabilities[i]) for i in range(len(classes))}
            result["probabilities"] = prob_dict

        return result
