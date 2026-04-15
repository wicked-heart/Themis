"""
analyzer.py — Core bias analysis logic for the /analyze endpoint.
Computes disparate impact, equalized odds, SHAP values, and a
weighted fairness score.
"""

import io
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from fairlearn.metrics import demographic_parity_ratio, equalized_odds_difference
import shap


def analyze_dataset(csv_bytes: bytes, protected_attr: str, target_col: str, model):
    """
    Analyze a CSV dataset for fairness issues.

    Returns dict with fairness_score, disparate_impact_ratio,
    equalized_odds_diff, top_features, and pass_fail verdicts.
    """
    # Read CSV
    df = pd.read_csv(io.BytesIO(csv_bytes))

    # Clean column names
    df.columns = [c.strip().lower().replace("-", "_") for c in df.columns]
    protected_attr = protected_attr.strip().lower().replace("-", "_")
    target_col = target_col.strip().lower().replace("-", "_")

    # Drop NaN
    df = df.dropna().reset_index(drop=True)

    # Store original protected attribute values BEFORE any encoding
    # Fairlearn must receive raw string labels, not encoded integers
    sensitive_raw = df[protected_attr].astype(str).copy()

    # Encode categoricals
    label_encoders = {}
    for col in df.select_dtypes(include=["object", "category"]).columns:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        label_encoders[col] = le

    # Ensure target encoding: ">50K" → 1, "<=50K" → 0
    if target_col in label_encoders:
        le = label_encoders[target_col]
        classes = list(le.classes_)
        print(f"[DEBUG] Target classes: {classes} (index 0={classes[0]}, index 1={classes[1]})")

        # Check if positive class (>50K) is at index 1
        # LabelEncoder sorts alphabetically: "<=50K"→0, ">50K"→1 which is correct
        # But some CSV variants have different strings, so verify
        positive_labels = [">50K", ">50k", ">50K.", ">50k."]
        positive_idx = None
        for pl in positive_labels:
            if pl in classes:
                positive_idx = classes.index(pl)
                break

        # If positive class is at index 0, flip the encoding
        if positive_idx == 0:
            print("[DEBUG] Flipping target encoding — positive class was at index 0")
            df[target_col] = 1 - df[target_col]

    X = df.drop(columns=[target_col])
    y = df[target_col]

    # Restore hyphenated column names to match model training
    column_map = {
        'education_num':  'education-num',
        'marital_status': 'marital-status',
        'capital_gain':   'capital-gain',
        'capital_loss':   'capital-loss',
        'hours_per_week': 'hours-per-week',
        'native_country': 'native-country',
    }
    X = X.rename(columns=column_map)

    # Predict
    y_pred = model.predict(X)

    # Debugging Wrong Values
    # Add this right after y_pred = model.predict(X)
    print(f"[DEBUG] sensitive_raw unique values: {sensitive_raw.unique()}")
    print(f"[DEBUG] y unique values: {y.unique()}")
    print(f"[DEBUG] y_pred unique values: {np.unique(y_pred)}")
    print(f"[DEBUG] y value counts: {pd.Series(y).value_counts().to_dict()}")

    # Check selection rate per group manually
    for group in sensitive_raw.unique():
        mask = sensitive_raw == group
        group_pred = y_pred[mask]
        selection_rate = group_pred.mean()
        print(f"[DEBUG] Group '{group}': {mask.sum()} rows, selection rate: {selection_rate:.4f}")

    # --- Disparate Impact Ratio ---
    # Uses demographic_parity_ratio directly (min selection rate / max selection rate)
    disparate_impact_ratio = float(
        demographic_parity_ratio(y, y_pred, sensitive_features=sensitive_raw)
    )

    # --- Equalized Odds Difference ---
    eod = float(
        equalized_odds_difference(y, y_pred, sensitive_features=sensitive_raw)
    )

    print(f"[DEBUG] Rows: {len(df)}, DPR: {disparate_impact_ratio:.4f}, EOD: {eod:.4f}")

    # --- SHAP Analysis ---
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)

    # Mean absolute SHAP per feature
    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    feature_names = X.columns.tolist()

    # Top 6 features
    top_indices = np.argsort(mean_abs_shap)[-6:][::-1]
    top_features = []
    for idx in top_indices:
        top_features.append({
            "feature": feature_names[idx],
            "shap_mean": round(float(mean_abs_shap[idx]), 3),
        })

    # SHAP fairness component: how much the protected attr influences predictions
    protected_idx = feature_names.index(protected_attr) if protected_attr in feature_names else -1
    if protected_idx >= 0:
        protected_shap = mean_abs_shap[protected_idx]
        max_shap = mean_abs_shap.max()
        shap_fairness = max(0, 1 - (protected_shap / max_shap)) if max_shap > 0 else 1.0
    else:
        shap_fairness = 1.0

    # --- Weighted Fairness Score ---
    fairness_score = (disparate_impact_ratio * 50) + ((1 - eod) * 50)
    fairness_score = max(0, min(100, fairness_score))

    # --- Pass/Fail Verdicts ---
    top_shap_val = top_features[0]["shap_mean"] if top_features else 0
    pass_fail = {
        "disparate_impact": "pass" if disparate_impact_ratio >= 0.8 else "fail",
        "equalized_odds": "pass" if eod <= 0.10 else "fail",
        "shap_influence": "warn" if top_shap_val > 0.25 else "pass",
    }
    return {
        "fairness_score": float(round(fairness_score, 1)),
        "disparate_impact_ratio": float(round(disparate_impact_ratio, 4)),
        "equalized_odds_diff": float(round(eod, 4)),
        "top_features": top_features,
        "pass_fail": pass_fail,
        "total_rows": len(df),
        "total_cols": len(X.columns),
    }
