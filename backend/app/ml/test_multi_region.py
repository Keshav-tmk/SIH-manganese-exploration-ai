"""
Phase 15 Tests: Multi-Region Model Training and Validation
==========================================================
Tests covering:
  - Region data generation (shape, labels, geological features)
  - Leave-One-Region-Out cross-validation structure and metrics
  - Final model training and artifact saving
  - MultiRegionTrainer lifecycle
  - API endpoint integration (FastAPI TestClient)
"""

import os
import sys
import json
import pytest
import tempfile
import numpy as np
import pandas as pd

# Ensure the backend/app directory is on the path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from ml.multi_region_trainer import (
    MANGANESE_REGIONS,
    FEATURE_COLUMNS,
    generate_region_samples,
    generate_all_region_data,
    MultiRegionTrainer,
    run_full_multi_region_pipeline,
    _haversine,
    _proximity_label,
    _spectral_signature,
)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def make_trainer(tmp_dir: str) -> MultiRegionTrainer:
    """Creates a trainer with temp dirs so tests don't pollute models/."""
    return MultiRegionTrainer(model_save_dir=tmp_dir, seed=42)


# ---------------------------------------------------------------------------
# Region Definition Tests
# ---------------------------------------------------------------------------

class TestRegionDefinitions:

    def test_all_regions_present(self):
        """Six core Indian manganese belts must be defined."""
        expected = {
            "sandur_ballari", "nagpur_bhandara", "balaghat",
            "sundergarh", "north_goa", "vizianagaram"
        }
        assert expected == set(MANGANESE_REGIONS.keys()), (
            f"Missing regions: {expected - set(MANGANESE_REGIONS.keys())}"
        )

    def test_region_schema(self):
        """Each region must have all required keys."""
        required_keys = {"name", "bbox", "state", "known_deposits", "geological_note", "n_samples"}
        for key, val in MANGANESE_REGIONS.items():
            missing = required_keys - set(val.keys())
            assert not missing, f"Region '{key}' missing keys: {missing}"

    def test_bboxes_are_valid(self):
        """Bounding boxes must have valid lat/lon ranges."""
        for key, val in MANGANESE_REGIONS.items():
            bbox = val["bbox"]
            assert -90 <= bbox["lat_min"] < bbox["lat_max"] <= 90, \
                f"Invalid lat range in {key}: {bbox}"
            assert -180 <= bbox["lon_min"] < bbox["lon_max"] <= 180, \
                f"Invalid lon range in {key}: {bbox}"

    def test_each_region_has_deposits(self):
        """Each region must have at least 2 known deposit locations."""
        for key, val in MANGANESE_REGIONS.items():
            deposits = val["known_deposits"]
            assert len(deposits) >= 2, \
                f"Region '{key}' has fewer than 2 known deposits."
            for d in deposits:
                assert "lat" in d and "lon" in d, \
                    f"Deposit in '{key}' missing lat/lon: {d}"

    def test_n_samples_reasonable(self):
        """Each region should have between 10 and 500 samples defined."""
        for key, val in MANGANESE_REGIONS.items():
            n = val["n_samples"]
            assert 10 <= n <= 500, f"n_samples={n} out of range for region '{key}'"


# ---------------------------------------------------------------------------
# Utility Function Tests
# ---------------------------------------------------------------------------

class TestUtilityFunctions:

    def test_haversine_same_point(self):
        """Distance from a point to itself must be 0."""
        d = _haversine(15.0, 76.5, np.array([15.0]), np.array([76.5]))
        assert np.isclose(d[0], 0.0, atol=1e-6)

    def test_haversine_known_distance(self):
        """Bangalore to Mysore is ~126 km — coarse sanity check."""
        d = _haversine(12.97, 77.59, np.array([12.30]), np.array([76.65]))
        assert 120 < d[0] < 160, f"Unexpected distance: {d[0]:.1f} km"

    def test_proximity_labels(self):
        assert _proximity_label(0.0) == "High"
        assert _proximity_label(4.9) == "High"
        assert _proximity_label(5.0) == "High"
        assert _proximity_label(5.1) == "Medium"
        assert _proximity_label(14.9) == "Medium"
        assert _proximity_label(15.0) == "Medium"
        assert _proximity_label(15.1) == "Low"
        assert _proximity_label(999.0) == "Low"

    def test_spectral_signature_ranges(self):
        """Spectral values must be within physically plausible (0–1) reflectance."""
        rng = np.random.default_rng(0)
        for label in ["High", "Medium", "Low"]:
            sig = _spectral_signature(label, rng)
            for band, val in sig.items():
                assert 0.0 <= val <= 1.0, \
                    f"Band {band} out of range for label {label}: {val}"

    def test_spectral_ndvi_ordering(self):
        """High prospectivity must have lower NDVI than Low on average."""
        rng = np.random.default_rng(1)
        ndvi_high = np.mean([_spectral_signature("High", rng)["NDVI"] for _ in range(50)])
        ndvi_low = np.mean([_spectral_signature("Low", rng)["NDVI"] for _ in range(50)])
        assert ndvi_high < ndvi_low, (
            f"Expected High NDVI ({ndvi_high:.3f}) < Low NDVI ({ndvi_low:.3f})"
        )


# ---------------------------------------------------------------------------
# Data Generation Tests
# ---------------------------------------------------------------------------

class TestDataGeneration:

    def test_single_region_shape(self):
        """Generated DataFrame must have correct columns and row count."""
        df = generate_region_samples("sandur_ballari", seed=42)
        expected_cols = set(FEATURE_COLUMNS) | {"latitude", "longitude", "prospectivity_label", "region"}
        assert expected_cols.issubset(set(df.columns)), \
            f"Missing columns: {expected_cols - set(df.columns)}"
        assert len(df) == MANGANESE_REGIONS["sandur_ballari"]["n_samples"]

    def test_coordinates_within_bbox(self):
        """All generated points must fall inside the region's bounding box."""
        for region_key, region_val in MANGANESE_REGIONS.items():
            df = generate_region_samples(region_key, seed=42)
            bbox = region_val["bbox"]
            assert (df["latitude"] >= bbox["lat_min"]).all(), \
                f"lat below min in {region_key}"
            assert (df["latitude"] <= bbox["lat_max"]).all(), \
                f"lat above max in {region_key}"
            assert (df["longitude"] >= bbox["lon_min"]).all(), \
                f"lon below min in {region_key}"
            assert (df["longitude"] <= bbox["lon_max"]).all(), \
                f"lon above max in {region_key}"

    def test_labels_are_valid(self):
        """All prospectivity labels must be one of High/Medium/Low."""
        valid_labels = {"High", "Medium", "Low"}
        for region_key in MANGANESE_REGIONS:
            df = generate_region_samples(region_key, seed=42)
            bad = set(df["prospectivity_label"].unique()) - valid_labels
            assert not bad, f"Invalid labels in {region_key}: {bad}"

    def test_all_regions_combined(self):
        """Combined dataset must have correct total rows and region diversity."""
        df = generate_all_region_data(seed=42)
        expected_total = sum(v["n_samples"] for v in MANGANESE_REGIONS.values())
        assert len(df) == expected_total, \
            f"Expected {expected_total} rows, got {len(df)}"
        assert set(df["region"].unique()) == set(MANGANESE_REGIONS.keys())

    def test_no_missing_feature_values(self):
        """Generated feature columns must have no NaN values."""
        df = generate_all_region_data(seed=42)
        for col in FEATURE_COLUMNS:
            assert df[col].isna().sum() == 0, \
                f"NaN values found in feature column '{col}'"

    def test_elevation_positive(self):
        """Elevation must be positive for all samples."""
        df = generate_all_region_data(seed=42)
        assert (df["elevation"] > 0).all(), "Found non-positive elevation values"

    def test_slope_bounded(self):
        """Slope must be between 0 and 45 degrees."""
        df = generate_all_region_data(seed=42)
        assert (df["slope"] >= 0).all() and (df["slope"] <= 45).all(), \
            "Slope values out of [0, 45] range"

    def test_seed_reproducibility(self):
        """Same seed must produce identical data."""
        df1 = generate_all_region_data(seed=99)
        df2 = generate_all_region_data(seed=99)
        pd.testing.assert_frame_equal(df1, df2)

    def test_different_seeds_differ(self):
        """Different seeds should produce different data."""
        df1 = generate_all_region_data(seed=1)
        df2 = generate_all_region_data(seed=2)
        assert not df1["latitude"].equals(df2["latitude"])


# ---------------------------------------------------------------------------
# MultiRegionTrainer Tests
# ---------------------------------------------------------------------------

class TestMultiRegionTrainer:

    def test_load_or_generate_creates_cache(self, tmp_path):
        trainer = make_trainer(str(tmp_path))
        data = trainer.load_or_generate_data()
        cache = os.path.join(trainer.data_cache_dir, "multi_region_data.csv")
        assert os.path.exists(cache), "Cache CSV was not created"
        assert len(data) > 0

    def test_load_uses_cache_on_second_call(self, tmp_path):
        trainer = make_trainer(str(tmp_path))
        data1 = trainer.load_or_generate_data()
        data2 = trainer.load_or_generate_data()  # Should load from cache
        assert len(data1) == len(data2)

    def test_force_regenerate(self, tmp_path):
        trainer = make_trainer(str(tmp_path))
        data1 = trainer.load_or_generate_data()
        data2 = trainer.load_or_generate_data(force_regenerate=True)
        assert len(data1) == len(data2)  # Same total, reproducible

    def test_loro_cv_runs(self, tmp_path):
        trainer = make_trainer(str(tmp_path))
        trainer.load_or_generate_data()
        results = trainer.run_loro_cross_validation()
        assert isinstance(results, list)
        assert len(results) == len(MANGANESE_REGIONS)

    def test_loro_cv_fold_structure(self, tmp_path):
        """Each fold result must have the required keys."""
        required_keys = {
            "held_out_region", "region_name", "state", "n_train", "n_test",
            "accuracy", "precision", "recall", "f1_score",
            "classification_report", "label_distribution"
        }
        trainer = make_trainer(str(tmp_path))
        trainer.load_or_generate_data()
        results = trainer.run_loro_cross_validation()
        for fold in results:
            missing = required_keys - set(fold.keys())
            assert not missing, f"Fold '{fold.get('held_out_region')}' missing keys: {missing}"

    def test_loro_metrics_in_range(self, tmp_path):
        """All aggregate LORO metrics must be in [0, 1]."""
        trainer = make_trainer(str(tmp_path))
        trainer.load_or_generate_data()
        trainer.run_loro_cross_validation()
        agg = trainer.avg_loro_metrics
        for metric in ["mean_accuracy", "mean_precision", "mean_recall", "mean_f1_score"]:
            val = agg.get(metric, -1)
            assert 0.0 <= val <= 1.0, f"{metric}={val} out of [0,1]"

    def test_each_region_appears_as_held_out_exactly_once(self, tmp_path):
        """Every region must be the held-out fold exactly once."""
        trainer = make_trainer(str(tmp_path))
        trainer.load_or_generate_data()
        results = trainer.run_loro_cross_validation()
        held_out_regions = [r["held_out_region"] for r in results]
        assert set(held_out_regions) == set(MANGANESE_REGIONS.keys()), \
            f"Not all regions appear as held-out. Got: {held_out_regions}"
        assert len(held_out_regions) == len(set(held_out_regions)), \
            "Some regions appear as held-out more than once"

    def test_train_test_sizes_are_complementary(self, tmp_path):
        """n_train + n_test must equal total samples for each fold."""
        trainer = make_trainer(str(tmp_path))
        data = trainer.load_or_generate_data()
        total = len(data)
        results = trainer.run_loro_cross_validation()
        for fold in results:
            assert fold["n_train"] + fold["n_test"] == total, \
                f"Train+test mismatch for {fold['held_out_region']}"

    def test_final_model_training(self, tmp_path):
        """Final model must be a fitted RandomForestClassifier."""
        from sklearn.ensemble import RandomForestClassifier
        trainer = make_trainer(str(tmp_path))
        trainer.load_or_generate_data()
        trainer.run_loro_cross_validation()
        model = trainer.train_final_model()
        assert isinstance(model, RandomForestClassifier)
        assert hasattr(model, "predict"), "Model missing predict method"

    def test_artifacts_saved(self, tmp_path):
        """All expected artifact files must be written to disk."""
        trainer = make_trainer(str(tmp_path))
        trainer.load_or_generate_data()
        trainer.run_loro_cross_validation()
        trainer.train_final_model()
        paths = trainer.save_artifacts()
        for name, path in paths.items():
            assert os.path.exists(path), f"Artifact '{name}' not saved at {path}"

    def test_evaluation_report_structure(self, tmp_path):
        """Saved evaluation report must have required top-level keys."""
        trainer = make_trainer(str(tmp_path))
        trainer.load_or_generate_data()
        trainer.run_loro_cross_validation()
        trainer.train_final_model()
        trainer.save_artifacts()
        report = trainer.load_evaluation_report()

        required = {
            "validation_strategy", "phase", "aggregate_loro_metrics",
            "per_fold_results", "feature_importances", "disclaimer"
        }
        missing = required - set(report.keys())
        assert not missing, f"Report missing keys: {missing}"

    def test_feature_importances_sum_to_one(self, tmp_path):
        """Feature importances from the final model must sum to ~1.0."""
        trainer = make_trainer(str(tmp_path))
        trainer.load_or_generate_data()
        trainer.run_loro_cross_validation()
        trainer.train_final_model()
        trainer.save_artifacts()
        report = trainer.load_evaluation_report()
        importances = report.get("feature_importances", {})
        total = sum(importances.values())
        assert abs(total - 1.0) < 0.01, f"Feature importances sum to {total:.4f}, expected ~1.0"

    def test_model_exists_before_after(self, tmp_path):
        """model_exists() must return False before training, True after."""
        trainer = make_trainer(str(tmp_path))
        assert not trainer.model_exists()
        trainer.load_or_generate_data()
        trainer.run_loro_cross_validation()
        trainer.train_final_model()
        trainer.save_artifacts()
        assert trainer.model_exists()

    def test_load_report_raises_before_train(self, tmp_path):
        """load_evaluation_report() must raise FileNotFoundError if not trained."""
        trainer = make_trainer(str(tmp_path))
        with pytest.raises(FileNotFoundError):
            trainer.load_evaluation_report()

    def test_full_pipeline_convenience_function(self, tmp_path):
        """run_full_multi_region_pipeline() must return a valid report dict."""
        report = run_full_multi_region_pipeline(str(tmp_path), seed=42)
        assert isinstance(report, dict)
        assert "aggregate_loro_metrics" in report
        assert "per_fold_results" in report


# ---------------------------------------------------------------------------
# API Endpoint Integration Tests
# ---------------------------------------------------------------------------

class TestMultiRegionAPI:

    @pytest.fixture
    def client(self, tmp_path, monkeypatch):
        """
        Creates a FastAPI TestClient with model_dir pointed at a temp directory,
        so API tests don't use the real models/ folder.
        """
        from fastapi.testclient import TestClient

        # Patch model_dir in main before import so predictors use temp dir
        import app.main as main_module
        monkeypatch.setattr(main_module, "model_dir", str(tmp_path))
        # Re-patch the _get_mr_trainer helper to use temp path
        monkeypatch.setattr(
            main_module, "_get_mr_trainer",
            lambda: MultiRegionTrainer(model_save_dir=str(tmp_path))
        )
        return TestClient(main_module.app)

    def test_multiregion_status_returns_200(self, client):
        resp = client.get("/api/multiregion/status")
        assert resp.status_code == 200

    def test_multiregion_status_content(self, client):
        data = client.get("/api/multiregion/status").json()
        assert data["status"] == "Online"
        assert data["total_regions"] == len(MANGANESE_REGIONS)
        assert "regions" in data
        assert set(data["regions"].keys()) == set(MANGANESE_REGIONS.keys())

    def test_multiregion_status_model_not_ready_initially(self, client):
        """Before training, multi_region_model_ready should be False."""
        data = client.get("/api/multiregion/status").json()
        assert data["multi_region_model_ready"] is False

    def test_multiregion_results_404_before_train(self, client):
        """GET /api/multiregion/results must return 404 before training."""
        resp = client.get("/api/multiregion/results")
        assert resp.status_code == 404

    def test_multiregion_train_returns_200(self, client):
        resp = client.post("/api/multiregion/train")
        assert resp.status_code == 200

    def test_multiregion_train_response_content(self, client):
        data = client.post("/api/multiregion/train").json()
        assert data["status"] == "success"
        assert "aggregate_loro_metrics" in data
        assert "mean_f1_score" in data
        assert data["n_folds"] == len(MANGANESE_REGIONS)

    def test_multiregion_results_200_after_train(self, client):
        """After training, GET /api/multiregion/results must return 200."""
        client.post("/api/multiregion/train")
        resp = client.get("/api/multiregion/results")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "report" in data

    def test_multiregion_status_model_ready_after_train(self, client):
        """After training, multi_region_model_ready must flip to True."""
        client.post("/api/multiregion/train")
        data = client.get("/api/multiregion/status").json()
        assert data["multi_region_model_ready"] is True

    def test_existing_endpoints_unaffected(self, client):
        """Phase 15 must not break existing API endpoints."""
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/geospatial/status").status_code == 200
        assert client.get("/api/geospatial/pilot-region").status_code == 200
        assert client.get("/api/forecast/status").status_code == 200


# ---------------------------------------------------------------------------
# Geological Data Consistency Tests
# ---------------------------------------------------------------------------

class TestGeologicalConsistency:

    def test_high_prospectivity_near_deposits(self):
        """
        Samples within 5 km of a known deposit should predominantly be labelled High.
        We inject synthetic points very close to each region's first deposit and verify.
        """
        for region_key, region_val in MANGANESE_REGIONS.items():
            first_deposit = region_val["known_deposits"][0]
            d_lat, d_lon = first_deposit["lat"], first_deposit["lon"]

            # Small offsets (~1 km)
            rng = np.random.default_rng(0)
            lats = d_lat + rng.uniform(-0.005, 0.005, 20)
            lons = d_lon + rng.uniform(-0.005, 0.005, 20)

            deps_lat = np.array([dep["lat"] for dep in region_val["known_deposits"]])
            deps_lon = np.array([dep["lon"] for dep in region_val["known_deposits"]])

            labels = []
            for lat, lon in zip(lats, lons):
                dists = _haversine(lat, lon, deps_lat, deps_lon)
                labels.append(_proximity_label(float(np.min(dists))))

            assert all(l == "High" for l in labels), (
                f"Near-deposit points in {region_key} not all labelled High: {set(labels)}"
            )

    def test_low_prospectivity_far_from_deposits(self):
        """
        Samples far (>20 km) from all deposits must be labelled Low.
        We check the corners of small, remote bboxes.
        """
        for region_key, region_val in MANGANESE_REGIONS.items():
            bbox = region_val["bbox"]
            deps_lat = np.array([dep["lat"] for dep in region_val["known_deposits"]])
            deps_lon = np.array([dep["lon"] for dep in region_val["known_deposits"]])

            # Check the bbox corners — at least the most remote one should be Low
            corners = [
                (bbox["lat_min"], bbox["lon_min"]),
                (bbox["lat_min"], bbox["lon_max"]),
                (bbox["lat_max"], bbox["lon_min"]),
                (bbox["lat_max"], bbox["lon_max"]),
            ]
            far_count = 0
            for lat, lon in corners:
                dists = _haversine(lat, lon, deps_lat, deps_lon)
                label = _proximity_label(float(np.min(dists)))
                if label == "Low":
                    far_count += 1
            # At least one corner in every region must be Low
            assert far_count >= 1, (
                f"No corner of {region_key} bbox is 'Low' — check deposit density"
            )

    def test_region_geology_notes_non_empty(self):
        """All geological notes must be non-empty strings."""
        for key, val in MANGANESE_REGIONS.items():
            note = val.get("geological_note", "")
            assert isinstance(note, str) and len(note) > 5, \
                f"Region '{key}' has empty/short geological_note."


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
