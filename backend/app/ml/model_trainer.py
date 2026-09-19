import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupKFold
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from .dataset_prep import prepare_dataset

def train_and_evaluate(features_path: str, labels_path: str, model_save_dir: str):
    """
    Trains a Random Forest classifier, evaluates it using Spatial GroupKFold,
    extracts feature importance, and saves the final generalized model.
    """
    # 1. Dataset Preparation
    print("Preparing dataset...")
    X, y, coords, preprocessor, feature_names, prep_report = prepare_dataset(features_path, labels_path)
    
    # 2. Spatial Cross Validation
    print("Assigning Spatial Blocks for Cross-Validation...")
    if not coords.empty:
        # 0.1 degree is roughly 11km at equator, enough to group nearby pixels
        groups = coords.apply(lambda row: f"{round(row['latitude'], 1)}_{round(row['longitude'], 1)}", axis=1).values
    else:
        groups = np.arange(len(X))
        
    unique_groups = len(np.unique(groups))
    unique_classes = y.unique()
    
    metrics = {'accuracy': [], 'precision': [], 'recall': [], 'f1_score': []}
    
    if unique_groups >= 3 and len(unique_classes) >= 2:
        n_splits = min(5, unique_groups)
        print(f"Running Spatial GroupKFold CV with {n_splits} splits...")
        gkf = GroupKFold(n_splits=n_splits)
        
        for train_idx, test_idx in gkf.split(X, y, groups=groups):
            X_train, X_test = X[train_idx], X[test_idx]
            y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
            
            if len(y_train.unique()) < 2:
                continue
                
            model_cv = RandomForestClassifier(random_state=42, class_weight='balanced', n_estimators=100)
            model_cv.fit(X_train, y_train)
            
            y_pred = model_cv.predict(X_test)
            metrics['accuracy'].append(accuracy_score(y_test, y_pred))
            metrics['precision'].append(precision_score(y_test, y_pred, average='weighted', zero_division=0))
            metrics['recall'].append(recall_score(y_test, y_pred, average='weighted', zero_division=0))
            metrics['f1_score'].append(f1_score(y_test, y_pred, average='weighted', zero_division=0))
    else:
        print("WARNING: Not enough spatial blocks or classes for spatial CV. Metrics will be zeroed.")
        
    avg_metrics = {k: float(np.mean(v)) if v else 0.0 for k, v in metrics.items()}
    
    # 3. Train Final Model
    print("Training Final Model on Full Valid Dataset...")
    model = RandomForestClassifier(random_state=42, class_weight='balanced', n_estimators=100)
    model.fit(X, y)
    
    # Evaluate full model on itself to get shape of confusion matrix
    y_pred_full = model.predict(X)
    conf_matrix = confusion_matrix(y, y_pred_full).tolist()
    
    evaluation_report = {
        "spatial_cv_metrics": avg_metrics,
        "full_dataset_confusion_matrix": conf_matrix,
        "spatial_blocks_count": unique_groups,
        "dataset_limitations": "Metrics reflect spatial cross-validation. Real-world geological accuracy still requires ground-truth multi-region verification."
    }

    # 4. Feature Importance
    importances = model.feature_importances_
    feature_importance_dict = {
        feature_names[i]: float(importances[i]) for i in range(len(feature_names))
    }
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
        "validation_strategy": "Spatial GroupKFold",
        "training_date": pd.Timestamp.now().isoformat()
    }
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=4)

    print(f"ML Pipeline complete. Artifacts saved to {model_save_dir}")
    return metadata

if __name__ == "__main__":
    import sys
    # traverse from ml -> app -> backend -> project root
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    
    f_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(base_dir, "data", "features", "features_X_real.csv")
    l_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(base_dir, "data", "features", "labels_y_real.csv")
    m_dir = sys.argv[3] if len(sys.argv) > 3 else os.path.join(base_dir, "models")
    
    train_and_evaluate(f_path, l_path, m_dir)
