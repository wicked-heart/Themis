"""
model_evaluator.py — Evaluates an uploaded model for fairness,
computing per-group metrics, calibration curves, and SHAP values.
"""

import io
import pickle
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.calibration import calibration_curve
from fairlearn.metrics import MetricFrame, equalized_odds_difference
import shap


def false_positive_rate(y_true, y_pred):
    """Compute false positive rate."""
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    return float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0


def false_negative_rate(y_true, y_pred):
    """Compute false negative rate."""
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    return float(fn / (fn + tp)) if (fn + tp) > 0 else 0.0


def evaluate_model(model_bytes: bytes, csv_bytes: bytes, protected_attr: str, target_col: str):
    """
    Evaluate an uploaded model file for fairness on a provided dataset.

    Returns overall accuracy, equalized odds diff, per-group metrics,
    calibration curves, and top SHAP features.
    """
    # Load model from bytes
    model = pickle.loads(model_bytes)

    # Read CSV
    df = pd.read_csv(io.BytesIO(csv_bytes))
    df.columns = [c.strip().lower().replace("-", "_") for c in df.columns]
    protected_attr = protected_attr.strip().lower().replace("-", "_")
    target_col = target_col.strip().lower().replace("-", "_")

    df = df.dropna().reset_index(drop=True)

    # Store original group labels before encoding
    original_groups = df[protected_attr].astype(str).copy()
    group_labels = original_groups.unique().tolist()

    # Encode categoricals
    label_encoders = {}
    for col in df.select_dtypes(include=["object", "category"]).columns:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        label_encoders[col] = le

    X = df.drop(columns=[target_col])
    y = df[target_col]
    sensitive = df[protected_attr]

    # Predictions
    y_pred = model.predict(X)

    # --- Overall Accuracy ---
    overall_acc = float(accuracy_score(y, y_pred))

    # --- Equalized Odds Difference ---
    eod = float(equalized_odds_difference(y, y_pred, sensitive_features=sensitive))

    # --- Per-group Metrics ---
    mf = MetricFrame(
        metrics={
            "accuracy": accuracy_score,
            "fpr": false_positive_rate,
            "fnr": false_negative_rate,
        },
        y_true=y,
        y_pred=y_pred,
        sensitive_features=original_groups,
    )

    group_metrics = {}
    by_group = mf.by_group
    for group in group_labels:
        group_metrics[group] = {
            "accuracy": round(float(by_group.loc[group, "accuracy"]), 3),
            "fpr": round(float(by_group.loc[group, "fpr"]), 3),
            "fnr": round(float(by_group.loc[group, "fnr"]), 3),
        }

    # --- Calibration Curves per Group ---
    calibration = {}
    try:
        y_proba = model.predict_proba(X)[:, 1]
        for group in group_labels:
            mask = original_groups == group
            if mask.sum() < 10:
                continue
            fraction_pos, mean_pred = calibration_curve(
                y[mask], y_proba[mask], n_bins=5, strategy="uniform"
            )
            calibration[group] = {
                "mean_predicted": [round(float(v), 2) for v in mean_pred],
                "fraction_positive": [round(float(v), 2) for v in fraction_pos],
            }
    except Exception:
        # Model may not support predict_proba
        for group in group_labels:
            calibration[group] = {
                "mean_predicted": [],
                "fraction_positive": [],
            }

    # --- SHAP Top Features ---
    try:
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X)
        mean_abs_shap = np.abs(shap_values).mean(axis=0)
        feature_names = X.columns.tolist()
        top_indices = np.argsort(mean_abs_shap)[-6:][::-1]
        top_features = [
            {
                "feature": feature_names[idx],
                "shap_mean": round(float(mean_abs_shap[idx]), 3),
            }
            for idx in top_indices
        ]
    except Exception:
        top_features = []

    return {
        "overall_accuracy": round(overall_acc, 3),
        "equalized_odds_diff": round(eod, 2),
        "group_metrics": group_metrics,
        "calibration": calibration,
        "top_features": top_features,
    }
