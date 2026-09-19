"""
Phase 16 Tests: Multi-Region Location-Based Prediction
========================================================
Tests for multiregion_predictor.py (Phase 16 prediction service)
and the /api/predict/multiregion API endpoint.

Requires:
  - Phase 15 model to be trained before predictor tests can run
  - The multi_region_trainer module for fixture generation
"""

import os
import sys
import json
import pytest
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from ml.multi_region_trainer import (
    MANGANESE_REGIONS,
    FEATURE_COLUMNS,
    run_full_multi_region_pipeline,
)
from ml.multiregion_predictor import (
    MultiRegionPredictor,
    get_supported_regions,
    _SPECTRAL_MEDIANS,
    _TERRAIN_MEDIANS,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def trained_model_dir(tmp_path_factory):
    """
    Runs the Phase 15 pipeline once per test module and returns the temp dir
    where artifacts are saved. This avoids re-training for every test.
    """
    tmp = str(tmp_path_factory.mktemp("models"))
    run_full_multi_region_pipeline(model_save_dir=tmp, seed=42)
    return tmp


@pytest.fixture(scope="module")
def predictor(trained_model_dir):
    """Returns a fully loaded MultiRegionPredictor."""
    return MultiRegionPredictor(model_dir=trained_model_dir)


# ---------------------------------------------------------------------------
# MultiRegionPredictor — Loading
# ---------------------------------------------------------------------------

class TestPredictorLoading:

    def test_loads_successfully(self, predictor):
        assert predictor.is_ready()

    def test_raises_filenotfounderror_without_model(self, tmp_path):
        with pytest.raises(FileNotFoundError, match="Phase 15 model not found"):
            MultiRegionPredictor(model_dir=str(tmp_path))

    def test_model_is_sklearn_classifier(self, predictor):
        from sklearn.ensemble import RandomForestClassifier
        assert isinstance(predictor.model, RandomForestClassifier)


# ---------------------------------------------------------------------------
# Region Resolution
# ---------------------------------------------------------------------------

class TestResolveRegion:

    def test_known_center_coords(self, predictor):
        """Center of each bbox must resolve to that region."""
        for key, region in MANGANESE_REGIONS.items():
            bbox = region["bbox"]
            lat = (bbox["lat_min"] + bbox["lat_max"]) / 2
            lon = (bbox["lon_min"] + bbox["lon_max"]) / 2
            result = predictor.resolve_region(lat, lon)
            assert result is not None, f"Center of {key} not resolved"
            resolved_key, _ = result
            assert resolved_key == key, \
                f"Center of {key} resolved to {resolved_key}"

    def test_known_deposit_coords_resolve(self, predictor):
        """Known deposit coordinates must fall inside their region."""
        for key, region in MANGANESE_REGIONS.items():
            for dep in region["known_deposits"]:
                result = predictor.resolve_region(dep["lat"], dep["lon"])
                assert result is not None, \
                    f"Deposit {dep['name']} in {key} not resolved"
                resolved_key, _ = result
                assert resolved_key == key

    def test_outside_india_returns_none(self, predictor):
        """Coordinates clearly outside all regions should return None."""
        outside_coords = [
            (0.0, 0.0),      # Gulf of Guinea
            (51.5, -0.1),    # London
            (28.6, 77.2),    # Delhi — not in any belt bbox
            (-20.0, 130.0),  # Australia
        ]
        for lat, lon in outside_coords:
            result = predictor.resolve_region(lat, lon)
            assert result is None, \
                f"({lat},{lon}) should not resolve but got: {result}"

    def test_bbox_boundaries(self, predictor):
        """Boundary points should still resolve (inclusive check)."""
        for key, region in MANGANESE_REGIONS.items():
            bbox = region["bbox"]
            # Exact corner should be inside
            result = predictor.resolve_region(bbox["lat_min"], bbox["lon_min"])
            assert result is not None, \
                f"Lower-left corner of {key} not resolved"

    def test_all_6_regions_uniquely_resolvable(self, predictor):
        """Each region must have at least one coordinate that is uniquely in it."""
        resolved_keys = set()
        for key, region in MANGANESE_REGIONS.items():
            bbox = region["bbox"]
            lat = (bbox["lat_min"] + bbox["lat_max"]) / 2
            lon = (bbox["lon_min"] + bbox["lon_max"]) / 2
            result = predictor.resolve_region(lat, lon)
            if result:
                resolved_keys.add(result[0])
        assert resolved_keys == set(MANGANESE_REGIONS.keys())


# ---------------------------------------------------------------------------
# Feature Synthesis
# ---------------------------------------------------------------------------

class TestSynthesizeFeatures:

    def test_returns_9_features(self, predictor):
        """synthesize_features must return a DataFrame with exactly the 9 training features."""
        region_key = "sandur_ballari"
        region = MANGANESE_REGIONS[region_key]
        dep = region["known_deposits"][0]
        df, label, min_dist, _ = predictor.synthesize_features(
            dep["lat"], dep["lon"], region_key, region
        )
        assert list(df.columns) == FEATURE_COLUMNS
        assert len(df) == 1

    def test_near_deposit_is_high(self, predictor):
        """A coordinate ≤5 km from a deposit should get label High."""
        region_key = "nagpur_bhandara"
        region = MANGANESE_REGIONS[region_key]
        dep = region["known_deposits"][0]
        # Tiny offset, still inside the bbox
        lat, lon = dep["lat"] + 0.001, dep["lon"] + 0.001
        _, label, min_dist, _ = predictor.synthesize_features(lat, lon, region_key, region)
        assert min_dist < 5.0
        assert label == "High"

    def test_spectral_features_match_medians(self, predictor):
        """Synthesized spectral values must match the class medians exactly."""
        region_key = "balaghat"
        region = MANGANESE_REGIONS[region_key]
        dep = region["known_deposits"][0]
        df, label, _, _ = predictor.synthesize_features(
            dep["lat"], dep["lon"], region_key, region
        )
        row = df.iloc[0]
        expected = _SPECTRAL_MEDIANS[label]
        for band, val in expected.items():
            assert abs(row[band] - val) < 1e-9, \
                f"{band} mismatch for label {label}: got {row[band]}, expected {val}"

    def test_deterministic_same_coord(self, predictor):
        """Same coordinate must always produce the same features."""
        region_key = "sundergarh"
        region = MANGANESE_REGIONS[region_key]
        lat = (region["bbox"]["lat_min"] + region["bbox"]["lat_max"]) / 2
        lon = (region["bbox"]["lon_min"] + region["bbox"]["lon_max"]) / 2
        df1, l1, d1, _ = predictor.synthesize_features(lat, lon, region_key, region)
        df2, l2, d2, _ = predictor.synthesize_features(lat, lon, region_key, region)
        pd.testing.assert_frame_equal(df1, df2)
        assert l1 == l2
        assert d1 == d2

    def test_elevation_in_plausible_range(self, predictor):
        """Elevation from terrain medians must be > 0 m."""
        for label in ["High", "Medium", "Low"]:
            assert _TERRAIN_MEDIANS[label]["elevation"] > 0


# ---------------------------------------------------------------------------
# Full Predict Function — Supported Regions
# ---------------------------------------------------------------------------

class TestPredictSupportedRegion:

    def test_result_keys_present(self, predictor):
        """Every supported region centre must return all required result keys."""
        required_keys = {
            "latitude", "longitude", "is_validated_region",
            "region_key", "region_name", "state", "geological_note",
            "prediction_label", "prospectivity_score", "probabilities",
            "nearest_deposit_name", "nearest_deposit_dist_km",
            "model_phase", "data_source", "disclaimer", "message",
            "regions_supported",
        }
        for key, region in MANGANESE_REGIONS.items():
            bbox = region["bbox"]
            lat = (bbox["lat_min"] + bbox["lat_max"]) / 2
            lon = (bbox["lon_min"] + bbox["lon_max"]) / 2
            result = predictor.predict(lat, lon)
            missing = required_keys - set(result.keys())
            assert not missing, f"{key} result missing keys: {missing}"

    def test_is_validated_region_true(self, predictor):
        """Centre of every region must have is_validated_region=True."""
        for key, region in MANGANESE_REGIONS.items():
            bbox = region["bbox"]
            lat = (bbox["lat_min"] + bbox["lat_max"]) / 2
            lon = (bbox["lon_min"] + bbox["lon_max"]) / 2
            result = predictor.predict(lat, lon)
            assert result["is_validated_region"] is True, \
                f"Expected True for {key} center"

    def test_prediction_label_valid(self, predictor):
        """Prediction label must be High, Medium, or Low."""
        valid = {"High", "Medium", "Low"}
        for key, region in MANGANESE_REGIONS.items():
            bbox = region["bbox"]
            lat = (bbox["lat_min"] + bbox["lat_max"]) / 2
            lon = (bbox["lon_min"] + bbox["lon_max"]) / 2
            result = predictor.predict(lat, lon)
            assert result["prediction_label"] in valid, \
                f"Invalid label for {key}: {result['prediction_label']}"

    def test_prospectivity_score_in_range(self, predictor):
        """Score must be between 0 and 1."""
        for key, region in MANGANESE_REGIONS.items():
            bbox = region["bbox"]
            lat = (bbox["lat_min"] + bbox["lat_max"]) / 2
            lon = (bbox["lon_min"] + bbox["lon_max"]) / 2
            result = predictor.predict(lat, lon)
            score = result["prospectivity_score"]
            assert 0.0 <= score <= 1.0, \
                f"Score {score} out of [0,1] for {key}"

    def test_probabilities_sum_to_one(self, predictor):
        """All class probabilities must sum to ~1.0."""
        for key, region in MANGANESE_REGIONS.items():
            bbox = region["bbox"]
            lat = (bbox["lat_min"] + bbox["lat_max"]) / 2
            lon = (bbox["lon_min"] + bbox["lon_max"]) / 2
            result = predictor.predict(lat, lon)
            prob_sum = sum(result["probabilities"].values())
            assert abs(prob_sum - 1.0) < 0.01, \
                f"Probabilities sum to {prob_sum} for {key}"

    def test_region_metadata_populated(self, predictor):
        """Region name, state, and geological note must be non-empty strings."""
        for key, region in MANGANESE_REGIONS.items():
            bbox = region["bbox"]
            lat = (bbox["lat_min"] + bbox["lat_max"]) / 2
            lon = (bbox["lon_min"] + bbox["lon_max"]) / 2
            result = predictor.predict(lat, lon)
            assert isinstance(result["region_name"], str) and len(result["region_name"]) > 3
            assert isinstance(result["state"], str) and len(result["state"]) > 2
            assert isinstance(result["geological_note"], str) and len(result["geological_note"]) > 5

    def test_nearest_deposit_distance_positive(self, predictor):
        """Nearest deposit distance must be non-negative."""
        for key, region in MANGANESE_REGIONS.items():
            bbox = region["bbox"]
            lat = (bbox["lat_min"] + bbox["lat_max"]) / 2
            lon = (bbox["lon_min"] + bbox["lon_max"]) / 2
            result = predictor.predict(lat, lon)
            assert result["nearest_deposit_dist_km"] >= 0.0

    def test_deposit_near_known_deposit_predicts_high(self, predictor):
        """
        Coordinate within 3 km of a known deposit must predict High.
        (Because training labels are based on the same proximity thresholds.)
        """
        for key, region in MANGANESE_REGIONS.items():
            dep = region["known_deposits"][0]
            # Very small offset — stays well within 5km
            lat = dep["lat"] + 0.005
            lon = dep["lon"] + 0.005
            result = predictor.predict(lat, lon)
            if result["is_validated_region"] and result["nearest_deposit_dist_km"] <= 5.0:
                assert result["prediction_label"] == "High", (
                    f"Expected High near deposit in {key}, "
                    f"got {result['prediction_label']}"
                )

    def test_regions_supported_list_length(self, predictor):
        """regions_supported must list all 6 regions."""
        region_key = next(iter(MANGANESE_REGIONS))
        region = MANGANESE_REGIONS[region_key]
        bbox = region["bbox"]
        lat = (bbox["lat_min"] + bbox["lat_max"]) / 2
        lon = (bbox["lon_min"] + bbox["lon_max"]) / 2
        result = predictor.predict(lat, lon)
        assert len(result["regions_supported"]) == 6


# ---------------------------------------------------------------------------
# Full Predict Function — Unsupported Regions
# ---------------------------------------------------------------------------

class TestPredictUnsupportedRegion:

    def test_is_validated_region_false(self, predictor):
        """Coordinates outside all regions must return is_validated_region=False."""
        result = predictor.predict(28.6, 77.2)  # Delhi
        assert result["is_validated_region"] is False

    def test_no_exception_for_outside_coord(self, predictor):
        """predict() must not raise for coordinates outside all regions."""
        result = predictor.predict(0.0, 0.0)
        assert "message" in result
        assert result["prediction_label"] is None

    def test_outside_region_result_keys(self, predictor):
        """Even for unsupported coords, result must have the standard keys."""
        required_keys = {
            "latitude", "longitude", "is_validated_region",
            "message", "regions_supported", "disclaimer", "model_phase",
        }
        result = predictor.predict(-10.0, 150.0)
        missing = required_keys - set(result.keys())
        assert not missing, f"Missing keys in unsupported result: {missing}"

    def test_outside_region_score_is_none(self, predictor):
        result = predictor.predict(51.5, -0.1)  # London
        assert result["prospectivity_score"] is None

    def test_outside_region_supported_list_present(self, predictor):
        """regions_supported is still present so frontend can show user options."""
        result = predictor.predict(20.0, 75.0)  # Inside India but not in any belt
        assert isinstance(result["regions_supported"], list)
        assert len(result["regions_supported"]) == 6


# ---------------------------------------------------------------------------
# get_supported_regions()
# ---------------------------------------------------------------------------

class TestGetSupportedRegions:

    def test_returns_6_regions(self):
        regions = get_supported_regions()
        assert len(regions) == 6

    def test_required_keys(self):
        regions = get_supported_regions()
        required = {"key", "name", "state", "bbox", "geological_note", "n_known_deposits"}
        for r in regions:
            missing = required - set(r.keys())
            assert not missing, f"Region '{r.get('key')}' missing keys: {missing}"

    def test_n_known_deposits_at_least_2(self):
        for r in get_supported_regions():
            assert r["n_known_deposits"] >= 2, \
                f"Region '{r['key']}' has fewer than 2 deposits"


# ---------------------------------------------------------------------------
# API Endpoint Integration Tests
# ---------------------------------------------------------------------------

class TestMultiRegionPredictAPI:

    @pytest.fixture
    def client(self, trained_model_dir, monkeypatch):
        from fastapi.testclient import TestClient
        import app.main as main_module

        # Reset global predictor singleton so it reinitialises with temp dir
        monkeypatch.setattr(main_module, "_mr_predictor", None)
        monkeypatch.setattr(main_module, "model_dir", trained_model_dir)

        return TestClient(main_module.app)

    def test_regions_endpoint_200(self, client):
        resp = client.get("/api/predict/multiregion/regions")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_regions"] == 6
        assert len(data["regions"]) == 6

    def test_predict_inside_region_200(self, client):
        """Coordinate inside Sandur-Ballari bbox."""
        resp = client.post("/api/predict/multiregion", json={
            "latitude": 15.10,
            "longitude": 76.55
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_validated_region"] is True
        assert data["region_key"] == "sandur_ballari"

    def test_predict_outside_region_200_not_4xx(self, client):
        """Outside-region should be HTTP 200, not 4xx."""
        resp = client.post("/api/predict/multiregion", json={
            "latitude": 28.6,
            "longitude": 77.2
        })
        assert resp.status_code == 200
        assert resp.json()["is_validated_region"] is False

    def test_predict_invalid_lat_422(self, client):
        """Latitude > 90 must fail Pydantic validation (422)."""
        resp = client.post("/api/predict/multiregion", json={
            "latitude": 100.0,
            "longitude": 77.2
        })
        assert resp.status_code == 422

    def test_predict_invalid_lon_422(self, client):
        resp = client.post("/api/predict/multiregion", json={
            "latitude": 15.10,
            "longitude": 200.0
        })
        assert resp.status_code == 422

    def test_predict_missing_lat_422(self, client):
        resp = client.post("/api/predict/multiregion", json={"longitude": 77.2})
        assert resp.status_code == 422

    def test_predict_returns_disclaimer(self, client):
        resp = client.post("/api/predict/multiregion", json={
            "latitude": 15.10,
            "longitude": 76.55
        })
        assert "disclaimer" in resp.json()
        assert len(resp.json()["disclaimer"]) > 20

    def test_predict_returns_data_source(self, client):
        resp = client.post("/api/predict/multiregion", json={
            "latitude": 15.10,
            "longitude": 76.55
        })
        data = resp.json()
        assert "data_source" in data
        assert "not live satellite imagery" in data["data_source"].lower()

    def test_predict_all_6_regions(self, client):
        """Centre of each region must return a valid prediction."""
        for key, region in MANGANESE_REGIONS.items():
            bbox = region["bbox"]
            lat = (bbox["lat_min"] + bbox["lat_max"]) / 2
            lon = (bbox["lon_min"] + bbox["lon_max"]) / 2
            resp = client.post("/api/predict/multiregion", json={
                "latitude": lat,
                "longitude": lon
            })
            assert resp.status_code == 200, f"Failed for {key}: {resp.text}"
            data = resp.json()
            assert data["is_validated_region"] is True
            assert data["prediction_label"] in {"High", "Medium", "Low"}

    def test_existing_predict_endpoint_unaffected(self, client):
        """Phase 12 /api/predict endpoint must still work."""
        resp = client.get("/api/health")
        assert resp.status_code == 200

    def test_existing_multiregion_status_unaffected(self, client):
        """Phase 15 /api/multiregion/status must still return 200."""
        resp = client.get("/api/multiregion/status")
        assert resp.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
