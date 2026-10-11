# Congestion model methodology and runtime validation

Verified 11 October 2026, branch `danial`. This describes the current notebook,
public source data, and unchanged `backend/rf_model.joblib`. It does not establish
accuracy on observed Batam traffic. [Machine-readable audit](../evidence/sprint-6/model-audit.json).

## Verified source and generation

The public project contains six road segments and 25 congestion windows.
Integer-hour expansion covers all 24 hours for each segment/day pair, with no
missing or overlapping buckets in this snapshot. Normal windows are half-open;
cross-midnight windows wrap, and equal endpoints represent a full day. The
source uses integer hours; this does not validate minute-level traffic timing.

The notebook generates 50 rows per covered hour, with NumPy seed 42 and uniform
multiplier noise of ±10%. Labels come directly from each window's congestion
level. The verified reproduction creates 14,400 rows:

| Class | Generated rows | Test rows |
| --- | ---: | ---: |
| LOW | 11,750 | 2,350 |
| MEDIUM | 1,750 | 350 |
| HIGH | 900 | 180 |
| Total | 14,400 | 2,880 |

Inputs are `hour`, `is_peak`, weekday/weekend dummy columns, and three corridor
dummy columns. `is_peak` is 1 for hours 6–9 and 16–19, inclusive, exactly as the
notebook encodes it. It is derived from hour rather than the target. Neither
multiplier noise nor segment ID enters the model. The seven encoded feature
names/order match the fitted artifact.

The split is stratified by label, random row split, 80% train/20% test, seed 42:
11,520 training rows and 2,880 test rows. The classifier is
`RandomForestClassifier(n_estimators=50, random_state=42)` with remaining fitted
parameters recorded in the audit. No class weighting or grouped holdout is used.
The multiplier mapping is the mean of all generated rows, rounded to three
decimals: HIGH 1.818, LOW 1.066, MEDIUM 1.227. API ML outputs retain the existing
two-decimal rounding. This mapping includes test rows and is a project constant,
not a held-out calibration of travel times.

## Reproduced results

The stored artifact and a temporary reproduction give identical predictions on
the reconstructed test split, identical feature order and multiplier mapping.
The stored artifact remains unchanged, SHA-256
`2923e269b053082861e435a66e0737c109c2c66dbc025d20e824cd1657ac4b97`.

| Metric | Verified value |
| --- | ---: |
| Accuracy | 95.0694% |
| Majority-LOW baseline on this split | 81.5972% |
| Macro F1 | 0.8619 |
| Weighted F1 | 0.9498 |

Confusion matrix: rows are actual labels, columns predicted labels.

| Actual / predicted | HIGH | LOW | MEDIUM |
| --- | ---: | ---: | ---: |
| HIGH | 148 | 16 | 16 |
| LOW | 23 | 2,327 | 0 |
| MEDIUM | 34 | 53 | 263 |

These reproduce the notebook's rounded 0.951 accuracy. They describe a synthetic
row split. There are only 144 unique input patterns across 14,400 rows, and all
2,880 test inputs also occur in training. Fifteen input patterns have conflicting
labels because segments sharing a corridor can have different window labels.
Repeating identical inputs and adding noise to an unused variable does not add
independent traffic observations.

The audit reproduces current-source behavior; the package contains only model,
feature columns, and multiplier mapping. It contains no original training date,
source snapshot hash, or evaluation metadata. Matching predictions/mapping does
not establish the original training timestamp or bit-for-bit reproduction of
the pickle. A grouped/source-window or independently observed traffic evaluation
is future research; it was not performed and no replacement model was deployed.

## Runtime compatibility and failure behavior

Verified runtime: Python 3.13.0, scikit-learn 1.9.0, NumPy 2.4.6, pandas 3.0.3,
joblib 1.5.3. Artifact loading emitted no compatibility warnings. Startup now
checks package keys, fitted feature count/order, classes, and positive finite
multiplier mappings. An inconsistent scikit-learn version warning disables this
artifact and uses recorded-data fallback. Prediction validates corridor
categories and mappings instead of silently filling an unknown category or
label with a default multiplier. See [scikit-learn persistence guidance](https://scikit-learn.org/stable/model_persistence.html).

| Condition | Behavior |
| --- | --- |
| Valid model and corridor | `source=ml_model`, `data_status=synthetic_estimate`. |
| Missing/incompatible model, prediction failure, unknown category/label/mapping | Try validated recorded windows. |
| One matching valid window | `source=database`, `data_status=database`, unknown observation freshness. |
| Successful empty lookup or no matching window | Existing assumed LOW/1.0 default, `source=fallback_default`, `data_status=default_fallback`, explicit limitations. |
| Initial corridor DB lookup unavailable | HTTP 503; do not claim another query to the same unavailable DB repaired it. |
| Recorded lookup unavailable, malformed rows, or ambiguous overlapping windows | HTTP 503; do not turn an error into an assumed or observed value. |
| Invalid segment/day/hour | HTTP 400 before database work; malformed HTTP integer remains 422. Known valid segment absent from DB remains 404. |

Every successful congestion response includes validated planning day/hour,
source/status/disclaimer, `observed_at=null`, and UTC calculation time. Source
labels and existing core field names are preserved for consumers. Oracle forwards
the service disclaimer into the saved result. A service failure becomes a safe
tool error with no result card; an explanatory assistant answer may still save
successfully without presenting a recommendation.

The existing route service has its own congestion/default path and simplified
emission formula. Its business logic was not rewritten. Oracle route results
remain estimates with a warning that defaults may be used. This audit does not
validate emissions, measured savings, or route-service fallback as live traffic.

## Reproduce without overwriting the artifact

From the repository root:

```powershell
& backend/.venv/Scripts/python.exe backend/scripts/audit_congestion_model.py --output docs/oracle/evidence/sprint-6/model-audit.json
& backend/.venv/Scripts/python.exe -m pytest backend/tests/test_congestion.py -q
```

The audit performs public reads, trains only a temporary in-memory reproduction,
and never calls `joblib.dump` or changes the notebook. Keep the original dataset
workbook/notebook as historical source; report verified results using this record.
