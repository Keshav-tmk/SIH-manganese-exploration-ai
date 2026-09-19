import os
import sys

base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(base_dir)

from app.ml.model_trainer import train_and_evaluate
from app.ml.prediction_service import ManganEXPredictor
import pandas as pd
import tempfile
import traceback

def test_pipeline():
    print("=== Phase 5 Pipeline Tests ===\n")
    
    # Paths for default sample data
    features_path = os.path.join(base_dir, "../data/features/features_X.csv")
    labels_path = os.path.join(base_dir, "../data/features/labels_y.csv")
    models_dir = os.path.join(base_dir, "../models")

    # TEST 1: Model Training and Saving
    print("Test 1: Model Training and Saving with Valid Dataset")
    try:
        metadata = train_and_evaluate(features_path, labels_path, models_dir)
        print("-> SUCCESS: Model trained and saved.\n")
    except Exception as e:
        print(f"-> FAILED: {str(e)}\n")
        traceback.print_exc()

    # TEST 2: Prediction Service Loading
    print("Test 2: Prediction Service Loading")
    try:
        predictor = ManganEXPredictor(models_dir)
        print("-> SUCCESS: Model and preprocessor loaded successfully.\n")
    except Exception as e:
        print(f"-> FAILED: {str(e)}\n")

    # TEST 3: Prediction with Valid Inputs
    print("Test 3: Prediction with Valid Inputs")
    valid_input = {
        'elevation': 400.0,
        'slope': 10.0,
        'vegetation_index': 0.6,
        'geological_feature': 'Basalt'
    }
    try:
        res = predictor.predict(valid_input)
        print(f"-> SUCCESS: Prediction: {res['prediction']}, Probabilities: {res.get('probabilities')}\n")
    except Exception as e:
        print(f"-> FAILED: {str(e)}\n")

    # TEST 4: Prediction with Missing Inputs
    print("Test 4: Prediction with Missing Inputs")
    missing_input = {
        'elevation': 400.0,
        'slope': 10.0,
        # missing vegetation_index and geological_feature
    }
    try:
        predictor.predict(missing_input)
        print("-> FAILED: Should have raised an error about missing features.\n")
    except ValueError as e:
        print(f"-> SUCCESS (Expected Error Caught): {str(e)}\n")

    # TEST 5: Incorrect Feature Order (Dictionaries handle this intrinsically, but let's pass extra fields)
    print("Test 5: Prediction with Extra Fields (Should be ignored)")
    extra_input = {
        'unknown_field': 999,
        'geological_feature': 'Basalt',
        'vegetation_index': 0.6,
        'slope': 10.0,
        'elevation': 400.0
    }
    try:
        res = predictor.predict(extra_input)
        print("-> SUCCESS: Handled extra fields gracefully and predicted successfully.\n")
    except Exception as e:
        print(f"-> FAILED: {str(e)}\n")

    # TEST 6: Missing Target Column handling
    print("Test 6: Missing Target Column during preparation")
    # Create temp files
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_y = os.path.join(temp_dir, "bad_labels.csv")
        pd.DataFrame({'wrong_target': [1,2,3]}).to_csv(temp_y, index=False)
        try:
            from app.ml.dataset_prep import prepare_dataset
            prepare_dataset(features_path, temp_y)
            print("-> FAILED: Should have raised ValueError.\n")
        except ValueError as e:
            print(f"-> SUCCESS (Expected Error Caught): {str(e)}\n")

if __name__ == "__main__":
    test_pipeline()
