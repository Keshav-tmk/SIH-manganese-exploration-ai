import os
import json
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from .dataset_prep import prepare_dataset

def train_and_evaluate(features_path: str, labels_path: str, model_save_dir: str):
    """
    Trains a Random Forest classifier, evaluates it, extracts feature importance,
    and saves the model and metadata.
    """
    # 1. Dataset Preparation
    print("Preparing dataset...")
    X_train, X_test, y_train, y_test, preprocessor, feature_names, prep_report = prepare_dataset(features_path, labels_path)
    
    # 2. Model Training
    print("Training Random Forest Classifier...")
    # Use class_weight='balanced' to handle potential class imbalances
    model = RandomForestClassifier(random_state=42, class_weight='balanced', n_estimators=100)
    
    # If the dataset has only 1 class (e.g. sample data edge case), we handle it safely
    unique_classes = y_train.unique()
    if len(unique_classes) < 2:
        print(f"WARNING: Only one class '{unique_classes[0]}' present in training data. Model will predict this class constantly.")
    
    model.fit(X_train, y_train)
    
    # 3. Model Evaluation
    print("Evaluating model...")
    y_pred = model.predict(X_test)
    
    # Check if we can compute multiclass metrics safely
    all_classes_test = y_test.unique()
    if len(all_classes_test) < 2 and len(unique_classes) < 2:
        # Edge case: Sample data might have only one class in the test set too.
        accuracy = accuracy_score(y_test, y_pred)
        precision, recall, f1 = 0.0, 0.0, 0.0 # Meaningless for single class
        conf_matrix = []
    else:
        accuracy = accuracy_score(y_test, y_pred)
        # We use weighted average for multi-class support
        precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
        recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
        f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
        conf_matrix = confusion_matrix(y_test, y_pred).tolist()

    evaluation_report = {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "confusion_matrix": conf_matrix,
        "dataset_limitations": "These results do not establish real-world geological prediction accuracy. They are based on a small sample dataset for pipeline validation only."
    }

    # 4. Feature Importance
    importances = model.feature_importances_
    # Create a sorted dictionary of feature importances
    feature_importance_dict = {
        feature_names[i]: float(importances[i]) for i in range(len(feature_names))
    }
    # Sort by importance (descending)
    sorted_importances = dict(sorted(feature_importance_dict.items(), key=lambda item: item[1], reverse=True))
    
    importance_report = {
        "feature_importances": sorted_importances,
        "disclaimer": "Feature importance does not prove geological causation. This is experimentally derived from sample data."
    }

    # 5. Save Artifacts
    print("Saving models and reports...")
    os.makedirs(model_save_dir, exist_ok=True)
    
    model_path = os.path.join(model_save_dir, "rf_model.joblib")
    preprocessor_path = os.path.join(model_save_dir, "preprocessor.joblib")
    eval_report_path = os.path.join(model_save_dir, "evaluation_report.json")
    importance_path = os.path.join(model_save_dir, "feature_importance.json")
    metadata_path = os.path.join(model_save_dir, "model_metadata.json")

    joblib.dump(model, model_path)
    joblib.dump(preprocessor, preprocessor_path)

    with open(eval_report_path, "w") as f:
        json.dump(evaluation_report, f, indent=4)
        
    with open(importance_path, "w") as f:
        json.dump(importance_report, f, indent=4)

    metadata = {
        "model_type": "RandomForestClassifier",
        "features": feature_names,
        "preparation_report": prep_report,
        "dataset_type": "sample",
        "training_date": pd.Timestamp.now().isoformat()
    }
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=4)

    print(f"ML Pipeline complete. Artifacts saved to {model_save_dir}")
    return metadata

if __name__ == "__main__":
    import sys
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    f_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(base_dir, "../data/features/features_X.csv")
    l_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(base_dir, "../data/features/labels_y.csv")
    m_dir = sys.argv[3] if len(sys.argv) > 3 else os.path.join(base_dir, "../models")
    
    train_and_evaluate(f_path, l_path, m_dir)
