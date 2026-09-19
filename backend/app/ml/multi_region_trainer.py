"""
Phase 15: Multi-Region Model Training and Validation
=====================================================
Implements Leave-One-Region-Out (LORO) cross-validation across multiple
Indian manganese mineral belts to assess the model's geographic generalization.

Regions covered:
  1. Sandur-Ballari, Karnataka (existing pilot region)
  2. Nagpur-Bhandara, Maharashtra
  3. Balaghat, Madhya Pradesh
  4. Sundergarh, Odisha
  5. North Goa, Goa
  6. Vizianagaram, Andhra Pradesh

Design contract:
  - All existing single-region functionality is PRESERVED and unchanged.
  - This module adds *new* artifacts alongside the existing rf_model.joblib.
  - Uses the same proximity-based High/Medium/Low labeling logic as
    generate_training_data.py for consistency.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report
)
from typing import Dict, List, Tuple, Any


# ---------------------------------------------------------------------------
# Region Definitions
# ---------------------------------------------------------------------------

MANGANESE_REGIONS: Dict[str, Dict[str, Any]] = {
    "sandur_ballari": {
        "name": "Sandur-Ballari (Bellary) Manganese Belt, Karnataka",
        "bbox": {"lat_min": 14.85, "lat_max": 15.27, "lon_min": 76.45, "lon_max": 76.75},
        "state": "Karnataka",
        "known_deposits": [
            {"lat": 15.10, "lon": 76.55, "name": "Sandur Main"},
            {"lat": 15.03, "lon": 76.62, "name": "Hospet Fringe"},
            {"lat": 14.92, "lon": 76.48, "name": "Ballari South"},
            {"lat": 15.18, "lon": 76.70, "name": "Toranagallu"},
        ],
        "geological_note": "BIF-hosted Mn deposits in Dharwar Craton greenstone belts",
        "n_samples": 120,
    },
    "nagpur_bhandara": {
        "name": "Nagpur-Bhandara Manganese Belt, Maharashtra",
        "bbox": {"lat_min": 20.85, "lat_max": 21.45, "lon_min": 79.55, "lon_max": 80.10},
        "state": "Maharashtra",
        "known_deposits": [
            {"lat": 21.10, "lon": 79.75, "name": "Kandri"},
            {"lat": 21.25, "lon": 79.85, "name": "Bhandara Main"},
            {"lat": 20.95, "lon": 79.60, "name": "Tumsar"},
            {"lat": 21.35, "lon": 80.00, "name": "Warora Fringe"},
        ],
        "geological_note": "Gondite-type Mn deposits hosted in Precambrian phyllites",
        "n_samples": 90,
    },
    "balaghat": {
        "name": "Balaghat Manganese Belt, Madhya Pradesh",
        "bbox": {"lat_min": 21.75, "lat_max": 22.30, "lon_min": 80.25, "lon_max": 80.75},
        "state": "Madhya Pradesh",
        "known_deposits": [
            {"lat": 22.05, "lon": 80.50, "name": "Balaghat Central"},
            {"lat": 21.85, "lon": 80.30, "name": "Ukwa"},
            {"lat": 22.20, "lon": 80.65, "name": "Baihar"},
        ],
        "geological_note": "Sedimentary Mn oxide deposits in Gondwana basin margins",
        "n_samples": 80,
    },
    "sundergarh": {
        "name": "Sundergarh Manganese Belt, Odisha",
        "bbox": {"lat_min": 22.00, "lat_max": 22.55, "lon_min": 84.05, "lon_max": 84.55},
        "state": "Odisha",
        "known_deposits": [
            {"lat": 22.25, "lon": 84.25, "name": "Sundergarh Main"},
            {"lat": 22.10, "lon": 84.15, "name": "Bonai"},
            {"lat": 22.45, "lon": 84.45, "name": "Panposh"},
        ],
        "geological_note": "Lateritized Mn deposits overlying BIF sequences in Eastern Ghats",
        "n_samples": 75,
    },
    "north_goa": {
        "name": "North Goa Manganese Belt, Goa",
        "bbox": {"lat_min": 15.45, "lat_max": 15.80, "lon_min": 73.85, "lon_max": 74.25},
        "state": "Goa",
        "known_deposits": [
            {"lat": 15.60, "lon": 74.05, "name": "Bicholim"},
            {"lat": 15.72, "lon": 74.18, "name": "Satari"},
        ],
        "geological_note": "Laterite-capped Mn enrichments in Deccan ferralitic terrain",
        "n_samples": 60,
    },
    "vizianagaram": {
        "name": "Vizianagaram Manganese Belt, Andhra Pradesh",
        "bbox": {"lat_min": 18.40, "lat_max": 18.90, "lon_min": 83.35, "lon_max": 83.85},
        "state": "Andhra Pradesh",
        "known_deposits": [
            {"lat": 18.55, "lon": 83.55, "name": "Garividi"},
            {"lat": 18.70, "lon": 83.68, "name": "Kodur"},
            {"lat": 18.45, "lon": 83.40, "name": "Vizianagaram South"},
        ],
        "geological_note": "Metamorphic Mn deposits in Eastern Ghats Mobile Belt khondalites",
        "n_samples": 65,
    },
}

# Feature columns that must match the existing model schema
FEATURE_COLUMNS = ["elevation", "slope", "NDVI", "B2", "B3", "B4", "B8", "B11", "B12"]
NUMERIC_TO_SCALE = FEATURE_COLUMNS  # All features are numeric


# ---------------------------------------------------------------------------
# Region Data Generation
# ---------------------------------------------------------------------------

def _haversine(lat1: float, lon1: float, lat2: np.ndarray, lon2: np.ndarray) -> np.ndarray:
    """Vectorized Haversine distance in km. Matches logic in generate_training_data.py."""
    R = 6371.0
    phi1 = np.radians(lat1)
    phi2 = np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlam = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlam / 2) ** 2
    return R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))


def _proximity_label(min_dist_km: float) -> str:
    """
    Converts nearest-deposit distance to a prospectivity label.
    Thresholds match generate_training_data.py exactly (5 km / 15 km).
    """
    if min_dist_km <= 5.0:
        return "High"
    elif min_dist_km <= 15.0:
        return "Medium"
    return "Low"


def _spectral_signature(label: str, rng: np.random.Generator) -> Dict[str, float]:
    """
    Generates physically plausible Sentinel-2 spectral signatures per prospectivity class.
    Values are in surface reflectance (0–1) and are geologically motivated:
      - High prospectivity → high iron oxide index (B4/B3 ratio), lower NDVI
      - Medium → mixed signature
      - Low → higher NDVI (vegetation cover), lower mineral expression
    """
    if label == "High":
        return {
            "NDVI":  float(rng.uniform(0.05, 0.25)),
            "B2":    float(rng.uniform(0.08, 0.14)),
            "B3":    float(rng.uniform(0.09, 0.16)),
            "B4":    float(rng.uniform(0.13, 0.22)),  # High red: iron oxide
            "B8":    float(rng.uniform(0.10, 0.20)),
            "B11":   float(rng.uniform(0.18, 0.32)),  # SWIR: mineral indicator
            "B12":   float(rng.uniform(0.14, 0.28)),
        }
    elif label == "Medium":
        return {
            "NDVI":  float(rng.uniform(0.20, 0.45)),
            "B2":    float(rng.uniform(0.06, 0.12)),
            "B3":    float(rng.uniform(0.08, 0.14)),
            "B4":    float(rng.uniform(0.08, 0.16)),
            "B8":    float(rng.uniform(0.18, 0.35)),
            "B11":   float(rng.uniform(0.10, 0.22)),
            "B12":   float(rng.uniform(0.08, 0.18)),
        }
    else:  # Low
        return {
            "NDVI":  float(rng.uniform(0.40, 0.75)),
            "B2":    float(rng.uniform(0.04, 0.09)),
            "B3":    float(rng.uniform(0.06, 0.11)),
            "B4":    float(rng.uniform(0.05, 0.11)),
            "B8":    float(rng.uniform(0.30, 0.55)),
            "B11":   float(rng.uniform(0.05, 0.15)),
            "B12":   float(rng.uniform(0.04, 0.12)),
        }


def generate_region_samples(region_key: str, seed: int = 42) -> pd.DataFrame:
    """
    Generates synthetic but geologically consistent training samples for a region.

    Each sample:
      - Has a random lat/lon within the region's bounding box
      - Receives a High/Medium/Low label via proximity to known deposits
      - Has physically plausible Sentinel-2 spectral values for that label
      - Has elevation and slope consistent with the terrain type

    Returns a DataFrame with columns:
      latitude, longitude, elevation, slope, NDVI, B2, B3, B4, B8, B11, B12,
      prospectivity_label, region
    """
    region = MANGANESE_REGIONS[region_key]
    bbox = region["bbox"]
    deposits = region["known_deposits"]
    n = region["n_samples"]

    rng = np.random.default_rng(seed + hash(region_key) % 1000)

    dep_lats = np.array([d["lat"] for d in deposits])
    dep_lons = np.array([d["lon"] for d in deposits])

    records = []
    for _ in range(n):
        lat = float(rng.uniform(bbox["lat_min"], bbox["lat_max"]))
        lon = float(rng.uniform(bbox["lon_min"], bbox["lon_max"]))

        distances = _haversine(lat, lon, dep_lats, dep_lons)
        min_dist = float(np.min(distances))
        label = _proximity_label(min_dist)

        spectral = _spectral_signature(label, rng)

        # Elevation: higher near High prospectivity (ridges, outcrops)
        elev_base = {"High": 550, "Medium": 400, "Low": 250}[label]
        elevation = float(rng.normal(elev_base, 80))
        elevation = max(10.0, elevation)

        slope = float(abs(rng.normal(12 if label == "High" else 7, 4)))
        slope = min(slope, 45.0)

        records.append({
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
            "elevation": round(elevation, 2),
            "slope": round(slope, 2),
            **{k: round(v, 6) for k, v in spectral.items()},
            "prospectivity_label": label,
            "region": region_key,
        })

    return pd.DataFrame(records)


def generate_all_region_data(seed: int = 42) -> pd.DataFrame:
    """
    Generates training data for all defined regions and concatenates into
    a single DataFrame with a 'region' column for LORO splitting.
    """
    dfs = []
    for region_key in MANGANESE_REGIONS:
        df = generate_region_samples(region_key, seed=seed)
        dfs.append(df)
        print(f"  [{region_key}] {len(df)} samples | "
              f"{df['prospectivity_label'].value_counts().to_dict()}")
    combined = pd.concat(dfs, ignore_index=True)
    print(f"\nTotal multi-region samples: {len(combined)}")
    return combined


# ---------------------------------------------------------------------------
# Multi-Region Trainer Class
# ---------------------------------------------------------------------------

class MultiRegionTrainer:
    """
    Trains and evaluates a Random Forest prospectivity model using
    Leave-One-Region-Out (LORO) cross-validation.

    LORO CV rationale:
      In spatial ML, the gold standard for generalization testing is to hold
      out an entire geographic region during training. This tests whether the
      model has learned transferable geological patterns rather than overfitting
      to local spatial autocorrelation.
    """

    MULTI_REGION_MODEL_SUBDIR = "multi_region"

    def __init__(self, model_save_dir: str, data_cache_dir: str = None, seed: int = 42):
        """
        Parameters
        ----------
        model_save_dir : str
            Root models directory (e.g. <project>/models). Multi-region
            artifacts go into <model_save_dir>/multi_region/.
        data_cache_dir : str, optional
            Directory to cache generated region data CSVs. Defaults to
            <model_save_dir>/multi_region/data/.
        seed : int
            Random seed for reproducibility.
        """
        self.seed = seed
        self.model_save_dir = model_save_dir
        self.mr_dir = os.path.join(model_save_dir, self.MULTI_REGION_MODEL_SUBDIR)

        if data_cache_dir is None:
            self.data_cache_dir = os.path.join(self.mr_dir, "data")
        else:
            self.data_cache_dir = data_cache_dir

        os.makedirs(self.mr_dir, exist_ok=True)
        os.makedirs(self.data_cache_dir, exist_ok=True)

        self.data: pd.DataFrame = None
        self.preprocessor: ColumnTransformer = None
        self.final_model: RandomForestClassifier = None
        self.loro_results: List[Dict[str, Any]] = []
        self.avg_loro_metrics: Dict[str, float] = {}

    # ------------------------------------------------------------------
    # Data Loading
    # ------------------------------------------------------------------

    def load_or_generate_data(self, force_regenerate: bool = False) -> pd.DataFrame:
        """
        Loads cached multi-region data if available, otherwise generates it.
        The cache is a CSV at <data_cache_dir>/multi_region_data.csv.
        """
        cache_path = os.path.join(self.data_cache_dir, "multi_region_data.csv")

        if os.path.exists(cache_path) and not force_regenerate:
            print(f"Loading cached multi-region data from {cache_path}")
            self.data = pd.read_csv(cache_path)
        else:
            print("Generating multi-region training data...")
            self.data = generate_all_region_data(seed=self.seed)
            self.data.to_csv(cache_path, index=False)
            print(f"Cached multi-region data to {cache_path}")

        return self.data

    # ------------------------------------------------------------------
    # Preprocessing
    # ------------------------------------------------------------------

    def _build_preprocessor(self, X: pd.DataFrame) -> ColumnTransformer:
        """Builds and fits a StandardScaler preprocessor matching existing schema."""
        cols_to_scale = [c for c in NUMERIC_TO_SCALE if c in X.columns]
        preprocessor = ColumnTransformer(
            transformers=[("num", StandardScaler(), cols_to_scale)],
            remainder="passthrough",
        )
        return preprocessor

    def _get_X_y(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """Extracts feature matrix and label series from a region DataFrame."""
        X = df[[c for c in FEATURE_COLUMNS if c in df.columns]].copy()
        y = df["prospectivity_label"].copy()
        return X, y

    # ------------------------------------------------------------------
    # Leave-One-Region-Out Cross-Validation
    # ------------------------------------------------------------------

    def run_loro_cross_validation(self) -> List[Dict[str, Any]]:
        """
        Performs Leave-One-Region-Out cross-validation.

        For each region R in MANGANESE_REGIONS:
          - Train on all samples NOT in region R
          - Evaluate on region R samples
          - Record per-class and aggregate metrics

        Returns
        -------
        list of dict
            One entry per region fold with keys:
            held_out_region, n_train, n_test, accuracy, precision, recall,
            f1_score, classification_report, label_distribution
        """
        if self.data is None:
            raise RuntimeError("Data not loaded. Call load_or_generate_data() first.")

        regions = self.data["region"].unique().tolist()
        if len(regions) < 2:
            raise ValueError(
                f"Need at least 2 regions for LORO CV. Got: {regions}"
            )

        print(f"\n{'='*60}")
        print(f"Leave-One-Region-Out Cross-Validation ({len(regions)} regions)")
        print(f"{'='*60}")

        self.loro_results = []
        agg_acc, agg_prec, agg_rec, agg_f1 = [], [], [], []

        for held_out in regions:
            train_df = self.data[self.data["region"] != held_out].copy()
            test_df = self.data[self.data["region"] == held_out].copy()

            X_train, y_train = self._get_X_y(train_df)
            X_test, y_test = self._get_X_y(test_df)

            # Skip fold if test or train has insufficient class diversity
            if y_train.nunique() < 2 or y_test.nunique() < 1:
                print(f"  [{held_out}] SKIPPED — insufficient class diversity in split")
                continue

            # Fit preprocessor on training data only (no leakage)
            fold_preprocessor = self._build_preprocessor(X_train)
            X_train_proc = fold_preprocessor.fit_transform(X_train)
            X_test_proc = fold_preprocessor.transform(X_test)

            model = RandomForestClassifier(
                n_estimators=100,
                random_state=self.seed,
                class_weight="balanced",
            )
            model.fit(X_train_proc, y_train)
            y_pred = model.predict(X_test_proc)

            acc = float(accuracy_score(y_test, y_pred))
            prec = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
            rec = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
            f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
            clf_report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)

            agg_acc.append(acc)
            agg_prec.append(prec)
            agg_rec.append(rec)
            agg_f1.append(f1)

            region_info = MANGANESE_REGIONS.get(held_out, {})
            fold_result = {
                "held_out_region": held_out,
                "region_name": region_info.get("name", held_out),
                "state": region_info.get("state", "Unknown"),
                "geological_note": region_info.get("geological_note", ""),
                "n_train": int(len(X_train)),
                "n_test": int(len(X_test)),
                "accuracy": round(acc, 4),
                "precision": round(prec, 4),
                "recall": round(rec, 4),
                "f1_score": round(f1, 4),
                "classification_report": clf_report,
                "label_distribution": y_test.value_counts().to_dict(),
            }
            self.loro_results.append(fold_result)

            print(
                f"  [{held_out}] "
                f"train={len(X_train)}, test={len(X_test)} | "
                f"acc={acc:.3f}, prec={prec:.3f}, rec={rec:.3f}, f1={f1:.3f}"
            )

        # Aggregate LORO metrics
        if agg_f1:
            self.avg_loro_metrics = {
                "mean_accuracy":  round(float(np.mean(agg_acc)), 4),
                "std_accuracy":   round(float(np.std(agg_acc)), 4),
                "mean_precision": round(float(np.mean(agg_prec)), 4),
                "std_precision":  round(float(np.std(agg_prec)), 4),
                "mean_recall":    round(float(np.mean(agg_rec)), 4),
                "std_recall":     round(float(np.std(agg_rec)), 4),
                "mean_f1_score":  round(float(np.mean(agg_f1)), 4),
                "std_f1_score":   round(float(np.std(agg_f1)), 4),
                "n_folds":        len(agg_f1),
            }

        print(f"\nLORO Average F1: {self.avg_loro_metrics.get('mean_f1_score', 0):.4f} "
              f"(±{self.avg_loro_metrics.get('std_f1_score', 0):.4f})")
        return self.loro_results

    # ------------------------------------------------------------------
    # Final Model Training
    # ------------------------------------------------------------------

    def train_final_model(self) -> RandomForestClassifier:
        """
        Trains the final generalized model on all multi-region data combined.
        Saves the preprocessor fitted on the full dataset.
        """
        if self.data is None:
            raise RuntimeError("Data not loaded. Call load_or_generate_data() first.")

        print("\nTraining final multi-region model on all data...")
        X, y = self._get_X_y(self.data)

        self.preprocessor = self._build_preprocessor(X)
        X_proc = self.preprocessor.fit_transform(X)

        self.final_model = RandomForestClassifier(
            n_estimators=150,
            random_state=self.seed,
            class_weight="balanced",
        )
        self.final_model.fit(X_proc, y)

        # In-sample metrics (upper bound, for reference only)
        y_pred_full = self.final_model.predict(X_proc)
        in_sample_acc = float(accuracy_score(y, y_pred_full))
        print(f"Final model in-sample accuracy: {in_sample_acc:.4f} (use LORO metrics for generalization)")
        return self.final_model

    # ------------------------------------------------------------------
    # Artifact Saving
    # ------------------------------------------------------------------

    def save_artifacts(self) -> Dict[str, str]:
        """
        Saves the multi-region model, preprocessor, and evaluation report.

        Artifacts written to <model_save_dir>/multi_region/:
          - mr_model.joblib              : trained final RandomForest
          - mr_preprocessor.joblib      : fitted StandardScaler pipeline
          - loro_evaluation_report.json : per-fold + aggregate LORO metrics
          - mr_model_metadata.json      : region definitions + training meta
        """
        if self.final_model is None:
            raise RuntimeError("Final model not trained. Call train_final_model() first.")

        paths = {}

        model_path = os.path.join(self.mr_dir, "mr_model.joblib")
        pre_path = os.path.join(self.mr_dir, "mr_preprocessor.joblib")
        eval_path = os.path.join(self.mr_dir, "loro_evaluation_report.json")
        meta_path = os.path.join(self.mr_dir, "mr_model_metadata.json")

        joblib.dump(self.final_model, model_path)
        joblib.dump(self.preprocessor, pre_path)
        paths["model"] = model_path
        paths["preprocessor"] = pre_path

        # Feature importance
        feature_imp = {}
        importances = self.final_model.feature_importances_
        feat_cols = [c for c in FEATURE_COLUMNS if c in
                     ([c for c in FEATURE_COLUMNS])]  # preserve order
        X_tmp, _ = self._get_X_y(self.data)
        actual_cols = [c for c in FEATURE_COLUMNS if c in X_tmp.columns]
        for i, col in enumerate(actual_cols):
            if i < len(importances):
                feature_imp[col] = round(float(importances[i]), 6)

        eval_report = {
            "validation_strategy": "Leave-One-Region-Out (LORO) Cross-Validation",
            "phase": "Phase 15 – Multi-Region Validation",
            "aggregate_loro_metrics": self.avg_loro_metrics,
            "per_fold_results": self.loro_results,
            "feature_importances": dict(
                sorted(feature_imp.items(), key=lambda x: x[1], reverse=True)
            ),
            "disclaimer": (
                "LORO CV metrics reflect cross-region generalization. "
                "Training data is synthetically generated from known deposit coordinates. "
                "Not a substitute for ground-truth field validation."
            ),
        }
        with open(eval_path, "w") as f:
            json.dump(eval_report, f, indent=4)
        paths["evaluation_report"] = eval_path

        metadata = {
            "model_type": "RandomForestClassifier",
            "n_estimators": 150,
            "features": FEATURE_COLUMNS,
            "validation_strategy": "Leave-One-Region-Out (LORO)",
            "regions": {
                k: {
                    "name": v["name"],
                    "state": v["state"],
                    "n_samples": v["n_samples"],
                    "geological_note": v["geological_note"],
                }
                for k, v in MANGANESE_REGIONS.items()
            },
            "training_date": pd.Timestamp.now().isoformat(),
            "phase": "Phase 15",
        }
        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=4)
        paths["metadata"] = meta_path

        print(f"\nMulti-region artifacts saved:")
        for k, p in paths.items():
            print(f"  {k}: {p}")

        return paths

    # ------------------------------------------------------------------
    # Convenience: Load Saved Report
    # ------------------------------------------------------------------

    def load_evaluation_report(self) -> Dict[str, Any]:
        """
        Loads the persisted LORO evaluation report if it exists.
        """
        eval_path = os.path.join(self.mr_dir, "loro_evaluation_report.json")
        if not os.path.exists(eval_path):
            raise FileNotFoundError(
                f"No multi-region evaluation report found at {eval_path}. "
                "Run train() first via POST /api/multiregion/train."
            )
        with open(eval_path) as f:
            return json.load(f)

    def model_exists(self) -> bool:
        """Returns True if a previously trained multi-region model exists on disk."""
        return os.path.exists(os.path.join(self.mr_dir, "mr_model.joblib"))


# ---------------------------------------------------------------------------
# Convenience: Full Training Pipeline
# ---------------------------------------------------------------------------

def run_full_multi_region_pipeline(
    model_save_dir: str,
    force_regenerate: bool = False,
    seed: int = 42,
) -> Dict[str, Any]:
    """
    Runs the complete Phase 15 multi-region training pipeline:
      1. Generate / load region data
      2. LORO cross-validation
      3. Train final model on all data
      4. Save artifacts

    Returns the evaluation report dict.
    """
    trainer = MultiRegionTrainer(model_save_dir=model_save_dir, seed=seed)
    trainer.load_or_generate_data(force_regenerate=force_regenerate)
    trainer.run_loro_cross_validation()
    trainer.train_final_model()
    trainer.save_artifacts()
    return trainer.load_evaluation_report()


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    # Traverse: ml -> app -> backend -> project root
    base_dir = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
    model_dir = os.path.join(base_dir, "models")
    force = "--force" in sys.argv

    print("=== ManganEX Phase 15: Multi-Region Training ===")
    report = run_full_multi_region_pipeline(model_dir, force_regenerate=force)
    print("\n=== LORO Summary ===")
    agg = report.get("aggregate_loro_metrics", {})
    print(f"  Mean F1   : {agg.get('mean_f1_score', 0):.4f} ± {agg.get('std_f1_score', 0):.4f}")
    print(f"  Mean Acc  : {agg.get('mean_accuracy', 0):.4f} ± {agg.get('std_accuracy', 0):.4f}")
    print(f"  Mean Prec : {agg.get('mean_precision', 0):.4f}")
    print(f"  Mean Rec  : {agg.get('mean_recall', 0):.4f}")
    print(f"  Folds     : {agg.get('n_folds', 0)}")
    print("\nPhase 15 complete.")
