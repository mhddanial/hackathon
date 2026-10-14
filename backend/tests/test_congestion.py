"""Congestion model contract and safe fallbacks, with no network/provider calls."""
from types import SimpleNamespace as NS

import numpy as np
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from routers import congestion as c
from services import oracle_tools

FEATURES = ['hour', 'is_peak', 'day_type_weekday', 'day_type_weekend',
    'corridor_type_access_road', 'corridor_type_industrial_arterial', 'corridor_type_urban_arterial']


class Model:
    n_features_in_ = 7
    feature_names_in_ = np.array(FEATURES)
    classes_ = np.array(['high', 'low', 'medium'])
    def __init__(self, label='high', error=False): self.label=label; self.error=error; self.rows=[]
    def predict(self, rows):
        self.rows.append(rows)
        if self.error: raise RuntimeError('private model diagnostic')
        return [self.label]


@pytest.fixture
def setup(monkeypatch):
    state = {'corridor': 'industrial_arterial', 'name': 'Jl. Yos Sudarso (Koridor Utama)', 'windows': [], 'calls': [], 'segment_error': False, 'fallback_error': False, 'missing': False}
    class Query:
        def table(self, name): self.name=name; return self
        def select(self, *args): return self
        def eq(self, *args): return self
        def execute(self):
            state['calls'].append(self.name)
            if state['segment_error'] and self.name=='road_segments' or state['fallback_error'] and self.name=='congestion_multipliers': raise RuntimeError('private database diagnostic')
            return NS(data=([] if state['missing'] else [{'corridor_type': state['corridor'], 'name': state['name']}]) if self.name=='road_segments' else state['windows'])
    monkeypatch.setattr(c, 'get_supabase_client', Query)
    monkeypatch.setattr(c, 'rf_model', None)
    monkeypatch.setattr(c, 'feature_columns', FEATURES)
    monkeypatch.setattr(c, 'level_to_multiplier', {'high':1.818,'low':1.066,'medium':1.227})
    return state


def call(hour=8, **kwargs): return c.get_congestion(segment_id='SEG001', day_type='weekday', hour=hour, **kwargs)


def test_corridor_outage_is_503_and_never_claims_a_database_fallback(setup):
    setup['segment_error']=True
    with pytest.raises(HTTPException) as exc: call()
    assert exc.value.status_code==503 and 'private' not in str(exc.value.detail)
    assert setup['calls']==['road_segments']


def test_default_preserves_planning_fields_and_explicit_uncertainty(setup):
    out=call()
    assert out['source']=='fallback_default' and out['day_type']=='weekday' and out['hour']==8
    assert out['data_status']=='default_fallback' and out['observed_at'] is None
    assert 'assumed' in out['disclaimer'].lower() and out['multiplier']==1.0


@pytest.mark.parametrize('source', ['ml_model', 'database', 'fallback_default'])
def test_road_name_reaches_endpoint_and_oracle_for_every_source(setup, monkeypatch, source):
    setup['name'] = 'Updated Yos Sudarso corridor'
    if source == 'ml_model': monkeypatch.setattr(c, 'rf_model', Model())
    if source == 'database':
        setup['windows'] = [{'hour_start': 0, 'hour_end': 24, 'congestion_level': 'LOW', 'multiplier': 1.1}]
    out = call()
    assert out['source'] == source and out['segment_id'] == 'SEG001'
    assert out['segment_name'] == setup['name']
    output, result = oracle_tools.execute_tool('get_congestion_level', {'segment_id': 'SEG001', 'day_type': 'weekday', 'hour': 8})
    assert result is not None and output['data']['segment_name'] == setup['name']


@pytest.mark.parametrize('hour',range(24))
def test_peak_feature_matches_training(hour):
    assert c.is_peak_hour(hour)==int(6<=hour<=9 or 16<=hour<=19)


@pytest.mark.parametrize('segment,day,hour',[('SEG007','weekday',8),('SEG001','holiday',8),('SEG001','weekday',-1),('SEG001','weekday',24),('SEG001','weekday',True)])
def test_invalid_inputs_are_rejected_before_database(setup,segment,day,hour):
    with pytest.raises(HTTPException) as exc: c.get_congestion(segment,day,hour)
    assert exc.value.status_code==400 and not setup['calls']


def test_missing_segment_remains_404(setup):
    setup['missing']=True
    with pytest.raises(HTTPException) as exc: call()
    assert exc.value.status_code==404


def test_model_uses_package_feature_order_and_mapping(setup,monkeypatch):
    model=Model(); monkeypatch.setattr(c,'rf_model',model)
    out=call(9)
    assert model.rows==[[[9,1,1,0,0,1,0]]]
    assert out['source']=='ml_model' and out['data_status']=='synthetic_estimate'
    assert out['congestion_level']=='HIGH' and out['multiplier']==1.82
    assert setup['calls']==['road_segments'] and out['observed_at'] is None


@pytest.mark.parametrize('kind',['missing_model','prediction_error','unknown_label','missing_mapping','unknown_corridor','feature_mismatch'])
def test_model_failure_uses_validated_database_window(setup,monkeypatch,kind):
    model=Model('surprise' if kind=='unknown_label' else 'high',kind=='prediction_error')
    monkeypatch.setattr(c,'rf_model',None if kind=='missing_model' else model)
    if kind=='missing_mapping': monkeypatch.setattr(c,'level_to_multiplier',{'low':1.0})
    if kind=='unknown_corridor': setup['corridor']='not_in_training'
    if kind=='feature_mismatch': monkeypatch.setattr(c,'feature_columns',['hour'])
    setup['windows']=[{'hour_start':6,'hour_end':10,'congestion_level':'MEDIUM','multiplier':1.2,'description':'Recorded estimate'}]
    out=call()
    assert out['source']=='database' and out['congestion_level']=='MEDIUM' and out['multiplier']==1.2
    assert out['data_status']=='database' and out['observed_at'] is None


@pytest.mark.parametrize('start,end,hour,matched',[(6,9,6,True),(6,9,9,False),(19,6,23,True),(19,6,0,True),(19,6,6,False),(0,24,23,True),(0,0,0,True),(6,6,23,True)])
def test_half_open_midnight_and_full_day_windows(setup,start,end,hour,matched):
    setup['windows']=[{'hour_start':start,'hour_end':end,'congestion_level':'HIGH','multiplier':1.85}]
    out=call(hour)
    assert out['source']==('database' if matched else 'fallback_default')
    assert out['day_type']=='weekday' and out['hour']==hour


@pytest.mark.parametrize('patch',[{'hour_start':-1},{'hour_start':24},{'hour_end':25},{'hour_start':6.5},{'congestion_level':'bogus'},{'multiplier':0},{'multiplier':float('nan')},{'multiplier':True}])
def test_malformed_database_rows_are_unavailable_not_assumed_data(setup,patch):
    setup['windows']=[{'hour_start':0,'hour_end':24,'congestion_level':'LOW','multiplier':1.0,**patch}]
    with pytest.raises(HTTPException) as exc: call()
    assert exc.value.status_code==503 and 'private' not in str(exc.value.detail)


def test_overlapping_windows_do_not_pick_arbitrary_first_row(setup):
    setup['windows']=[{'hour_start':0,'hour_end':24,'congestion_level':'LOW','multiplier':1.0},{'hour_start':6,'hour_end':9,'congestion_level':'HIGH','multiplier':2.0}]
    with pytest.raises(HTTPException) as exc: call()
    assert exc.value.status_code==503


def test_database_fallback_outage_returns_503(setup):
    setup['fallback_error']=True
    with pytest.raises(HTTPException) as exc: call()
    assert exc.value.status_code==503


@pytest.mark.parametrize('kind',['missing_key','bad_model','duplicate_features','feature_names','feature_count','bad_mapping'])
def test_artifact_package_is_validated(kind):
    model=Model(); pkg={'model':model,'feature_columns':FEATURES,'level_to_multiplier':{'high':1.8,'low':1.0,'medium':1.2}}
    if kind=='missing_key': del pkg['model']
    elif kind=='bad_model': pkg['model']=object()
    elif kind=='duplicate_features': pkg['feature_columns']=FEATURES+[FEATURES[0]]
    elif kind=='feature_names': model.feature_names_in_=np.array(list(reversed(FEATURES)))
    elif kind=='feature_count': model.n_features_in_=1
    else: pkg['level_to_multiplier']['high']=float('inf')
    with pytest.raises(ValueError): c.validate_package(pkg)


def test_oracle_outage_has_safe_error_without_result_card(setup):
    setup['segment_error']=True
    output,result=oracle_tools.execute_tool('get_congestion_level',{'segment_id':'SEG001','day_type':'weekday','hour':8})
    assert result is None and output['code']=='tool_unavailable' and 'private' not in str(output)


def test_http_status_contract_and_weekday_normalization(setup):
    app=FastAPI(); app.include_router(c.router,prefix='/congestion')
    with TestClient(app) as client:
        out=client.get('/congestion',params={'segment_id':'SEG001','day_type':'WEEKDAY','hour':0})
        assert out.status_code==200 and out.json()['hour']==0 and out.json()['day_type']=='weekday'
        assert client.get('/congestion',params={'segment_id':'SEG001','day_type':'weekday','hour':'x'}).status_code==422
        setup['segment_error']=True
        assert client.get('/congestion',params={'segment_id':'SEG001','day_type':'weekday','hour':8}).status_code==503
