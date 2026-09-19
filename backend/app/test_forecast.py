import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.forecasting.forecaster import ManganeseForecaster

@pytest.fixture
def forecaster():
    return ManganeseForecaster()

def test_initialization(forecaster):
    assert forecaster is not None
    assert forecaster.model_prod is None

def test_data_loading(forecaster):
    forecaster.load_and_clean_data()
    assert len(forecaster.df) > 0
    assert 'year' in forecaster.df.columns
    assert 'production_kt' in forecaster.df.columns

def test_model_training(forecaster):
    forecaster.load_and_clean_data()
    forecaster.train_models()
    assert forecaster.model_prod is not None
    assert forecaster.model_demand is not None

def test_model_evaluation(forecaster):
    forecaster.load_and_clean_data()
    metrics = forecaster.evaluate_models()
    assert 'production' in metrics
    assert 'demand' in metrics
    assert metrics['production']['mae'] >= 0

def test_forecast_future(forecaster):
    forecaster.load_and_clean_data()
    forecaster.train_models()
    forecasts = forecaster.forecast_future(years_ahead=5)
    assert len(forecasts) == 5
    assert forecasts[0]['is_forecast'] is True

def test_historical_data(forecaster):
    forecaster.load_and_clean_data()
    history = forecaster.get_historical_data()
    assert len(history) > 0
    assert 'supply_gap_kt' in history[0]
    assert history[0]['is_forecast'] is False
