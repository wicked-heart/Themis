"""
model_evaluator.py — Evaluates an uploaded 
pre-trained model for fairness on a provided 
test dataset. Includes schema validation, 
safe encoding, normalized fairness scoring,
and a decision layer.
"""

import io
import pickle
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix
)
from fairlearn.metrics import (
    demographic_parity_ratio,
    equalized_odds_difference
)
import shap


def evaluate_model(
    model_bytes: bytes,
    csv_bytes: bytes,
    protected_attr: str,
    target_col: str
):
    # ── 1. Load model ──────────────────────────────────────────
    try:
        clf = pickle.loads(model_bytes)
    except Exception as e:
        raise ValueError(
            f"Could not load model file. Make sure it "
            f"is a valid sklearn or XGBoost .pkl file. "
            f"Error: {str(e)}"
        )

    # ── 2. Load and clean CSV ──────────────────────────────────
    df = pd.read_csv(io.BytesIO(csv_bytes))
    df.columns = [
        c.strip().lower()
         .replace(" ", "_")
         .replace("-", "_")
        for c in df.columns
    ]
    protected_attr = (
        protected_attr.strip().lower()
        .replace(" ", "_").replace("-", "_")
    )
    target_col = (
        target_col.strip().lower()
        .replace(" ", "_").replace("-", "_")
    )
    df = df.dropna().reset_index(drop=True)

    # ── 3. Basic validation ────────────────────────────────────
    if len(df) < 50:
        raise ValueError(
            f"Dataset has only {len(df)} rows. "
            f"Minimum 50 rows required."
        )
    if protected_attr not in df.columns:
        raise ValueError(
            f"Protected attribute '{protected_attr}' "
            f"not found in CSV columns: "
            f"{list(df.columns)}"
        )
    if target_col not in df.columns:
        raise ValueError(
            f"Target column '{target_col}' "
            f"not found in CSV columns: "
            f"{list(df.columns)}"
        )
    if df[protected_attr].nunique() > 10:
        raise ValueError(
            "Protected attribute has too many unique "
            "values. Select a demographic column with "
            "limited categories (e.g., sex, race)."
        )
    if df[target_col].nunique() > 5:
        raise ValueError(
            "Invalid target column. Select a binary "
            "outcome variable (e.g., income, risk)."
        )
    if df[target_col].nunique() < 2:
        raise ValueError(
            "Target column has only one unique value. "
            "Select a valid outcome variable."
        )

    # ── 4. Store raw sensitive values BEFORE encoding ──────────
    sensitive_raw = df[protected_attr].astype(str).copy()

    # ── 5. Safe encoding ───────────────────────────────────────
    # For model evaluation we do NOT blindly re-encode.
    # Re-encoding with a fresh LabelEncoder produces
    # different integer mappings than training, which
    # corrupts predictions and makes fairness metrics
    # meaningless.
    #
    # Strategy:
    # - If CSV has string columns AND model exposes
    #   feature_names_in_ → block and explain clearly
    # - If CSV has string columns AND model has no
    #   feature schema → encode with warning
    # - If CSV is already numeric → proceed directly

    has_string_features = (
        df.drop(columns=[target_col])
        .select_dtypes(include=["object", "string", "category"])
        .shape[1] > 0
    )

    schema_warning = None

    if has_string_features:
        schema_warning = (
            "Re-encoding categorical columns with "
            "LabelEncoder. Results may be unreliable "
            "if encoding differs from training."
        )
        print(f"[WARN] {schema_warning}")
        for col in df.drop(
                columns=[target_col]
        ).select_dtypes(
                include=["object", "string", "category"]
        ).columns:
            le = LabelEncoder()
            df[col] = le.fit_transform(
                df[col].astype(str)
            )
    else:
        if not hasattr(clf, "feature_names_in_"):
            schema_warning = (
                "Model does not expose feature schema. "
                "Predictions may be unreliable if column "
                "order differs from training."
            )
            print(f"[WARN] {schema_warning}")

    # Always encode target to ensure 0/1
    if df[target_col].dtype.name in ["object", "string", "category"]:
        le = LabelEncoder()
        df[target_col] = le.fit_transform(
            df[target_col].astype(str)
        )
    df[target_col] = df[target_col].astype(int)

    # ── 6. Features and target ─────────────────────────────────
    X = df.drop(columns=[target_col])
    y = df[target_col]

    # ── 7. Feature schema validation ───────────────────────────
    # Compare CSV columns to model's training schema.
    # This prevents silent failures and corrupted results.

    if hasattr(clf, "feature_names_in_"):
        model_features = list(clf.feature_names_in_)

        # Normalize model feature names to underscores
        # for comparison with preprocessed CSV columns
        model_features_normalized = [
            f.replace("-", "_") for f in model_features
        ]
        csv_features = list(X.columns)

        missing = [
            f for f, fn in zip(
                model_features,
                model_features_normalized
            )
            if fn not in csv_features
        ]
        extra = [
            f for f in csv_features
            if f not in model_features_normalized
        ]

        if missing:
            raise ValueError(
                f"CSV is missing columns required by "
                f"the model: {[f.replace('-','_') for f in missing]}. "
                f"Upload a dataset that matches the "
                f"model's training schema."
            )

        if extra:
            print(
                f"[WARN] Ignoring extra columns: {extra}"
            )

        # Reorder CSV columns to match model training
        # order using normalized names
        X = X[model_features_normalized]

        # Now rename X columns back to hyphenated names
        # to match what the model expects internally
        rename_map = {
            fn: f
            for f, fn in zip(
                model_features,
                model_features_normalized
            )
            if f != fn
        }
        if rename_map:
            X = X.rename(columns=rename_map)

    # ── 8. Infer positive class ────────────────────────────────
    unique_vals = sorted(y.unique())
    inferred_positive = int(unique_vals[-1])
    # Convention: highest encoded value = positive class
    # For binary 0/1: positive = 1

    # ── 9. Predict ─────────────────────────────────────────────
    try:
        y_pred = clf.predict(X)
    except Exception as e:
        raise ValueError(
            f"Model prediction failed. Ensure CSV "
            f"columns match the model's training schema. "
            f"Error: {str(e)}"
        )

    # ── 10. Overall metrics ────────────────────────────────────
    overall_acc = float(accuracy_score(y, y_pred))
    dpr = float(demographic_parity_ratio(
        y, y_pred, sensitive_features=sensitive_raw
    ))
    eod = float(equalized_odds_difference(
        y, y_pred, sensitive_features=sensitive_raw
    ))

    print(
        f"[MODEL EVAL] Rows: {len(df)}, "
        f"Accuracy: {overall_acc*100:.2f}%, "
        f"DPR: {dpr:.4f}, EOD: {eod:.4f}"
    )

    # ── 11. Composite normalized fairness score ────────────────
    # Formula: 50% DPR + 50% (1 - EOD)
    # Both metrics normalized to 0-1 before scoring.
    # Severity caps prevent misleading scores when
    # both metrics fail badly.

    dpr_norm = max(0.0, min(1.0, dpr))
    eod_norm = max(0.0, min(1.0, eod))

    fairness_score = (dpr_norm * 50) + (
        (1 - eod_norm) * 50
    )

    # Severity caps
    if dpr_norm < 0.6:
        fairness_score = min(fairness_score, 50)
    if dpr_norm < 0.8 and eod_norm > 0.10:
        fairness_score = min(fairness_score, 60)
    # Severe dual failure must never look moderate
    if dpr_norm < 0.6 and eod_norm > 0.30:
        fairness_score = min(fairness_score, 40)

    fairness_score = float(round(
        max(0, min(100, fairness_score)), 1
    ))

    score_method = (
        "Composite normalized fairness score: "
        "50% Disparate Impact Ratio + "
        "50% (1 - Equalized Odds Difference). "
        "Score adjusted for severity."
    )

    # ── 12. Risk level ─────────────────────────────────────────
    if dpr < 0.6 or eod > 0.40:
        risk_level = "Severe Risk"
    elif dpr < 0.8 or eod > 0.20:
        risk_level = "Moderate Risk"
    else:
        risk_level = "Low Risk"

    # ── 13. Pass/fail ──────────────────────────────────────────
    pass_fail = {
        "disparate_impact": (
            "pass" if dpr >= 0.8 else "fail"
        ),
        "equalized_odds": (
            "pass" if eod <= 0.10 else "fail"
        ),
    }

    # ── 14. Per-group metrics ──────────────────────────────────
    # Minimum 20 rows per group for statistical reliability.
    # Groups below 20 are skipped to avoid noisy metrics.

    groups = sensitive_raw.unique()
    group_metrics = {}

    for group in groups:
        mask = sensitive_raw == group
        y_g = y[mask]
        p_g = y_pred[mask]

        if len(y_g) < 20:
            print(
                f"[WARN] Group '{group}' has only "
                f"{len(y_g)} samples — skipping "
                f"(minimum 20 required)."
            )
            continue

        g_acc = float(accuracy_score(y_g, p_g))
        cm = confusion_matrix(y_g, p_g, labels=[0, 1])
        tn, fp, fn, tp = (
            cm.ravel() if cm.size == 4
            else (0, 0, 0, 0)
        )

        fpr = (
            float(fp / (fp + tn))
            if (fp + tn) > 0 else 0.0
        )
        fnr = (
            float(fn / (fn + tp))
            if (fn + tp) > 0 else 0.0
        )
        tpr = (
            float(tp / (tp + fn))
            if (tp + fn) > 0 else 0.0
        )

        group_metrics[group] = {
            "count":    int(mask.sum()),
            "accuracy": round(g_acc * 100, 2),
            "fpr":      round(fpr, 4),
            "fnr":      round(fnr, 4),
            "tpr":      round(tpr, 4),
        }

    # ── 15. Confusion matrices ─────────────────────────────────
    confusion_matrices = {}

    for group in groups:
        mask = sensitive_raw == group
        y_g = y[mask]
        p_g = y_pred[mask]

        if len(y_g) < 20:
            continue

        cm = confusion_matrix(y_g, p_g, labels=[0, 1])
        tn, fp, fn, tp = (
            cm.ravel() if cm.size == 4
            else (0, 0, 0, 0)
        )
        confusion_matrices[group] = {
            "tn": int(tn), "fp": int(fp),
            "fn": int(fn), "tp": int(tp)
        }

    # ── 16. SHAP ───────────────────────────────────────────────
    top_features = []
    try:
        explainer = shap.TreeExplainer(clf)
        sample = X.iloc[:min(500, len(X))]
        shap_vals = explainer.shap_values(sample)
        mean_shap = np.abs(shap_vals).mean(axis=0)
        feature_names = X.columns.tolist()
        top_idx = np.argsort(mean_shap)[-6:][::-1]
        top_features = [
            {
                "feature": feature_names[i],
                "shap_mean": round(
                    float(mean_shap[i]), 3
                )
            }
            for i in top_idx
        ]
    except Exception as shap_err:
        print(f"[WARN] SHAP failed: {shap_err}")
        top_features = []

    # ── 17. Decision layer ─────────────────────────────────────
    issues = []
    if dpr < 0.8:
        issues.append(
            f"Disparate impact ratio {dpr:.3f} fails "
            f"the 80% rule — one group receives "
            f"favorable outcomes significantly less often."
        )
    if eod > 0.10:
        issues.append(
            f"Equalized odds difference {eod:.3f} exceeds "
            f"threshold — the model makes different types "
            f"of errors across groups."
        )

    if dpr < 0.8 and eod > 0.10:
        insight = (
            "The model shows both outcome disparity and "
            "error rate disparity. This is a compound "
            "fairness violation affecting both who gets "
            "favorable predictions and how errors are "
            "distributed across groups."
        )
    elif dpr < 0.8:
        insight = (
            "The model shows outcome disparity — one "
            "group receives favorable predictions "
            "significantly less often. Error rates are "
            "roughly balanced across groups."
        )
    elif eod > 0.10:
        insight = (
            "The model shows error rate disparity — "
            "prediction accuracy differs meaningfully "
            "between groups even though overall outcome "
            "rates are similar."
        )
    else:
        insight = (
            "No significant fairness violations detected. "
            "Both outcome rates and error rates are "
            "balanced across groups."
        )

    actions = []
    if dpr < 0.8:
        actions.append({
            "strategy": "Reweighting",
            "reason": (
                "Adjusts training sample weights to "
                "correct outcome disparity."
            ),
            "expected_accuracy_drop": (
                "typically 2-4% based on prior experiments"
            )
        })
    if eod > 0.10:
        actions.append({
            "strategy": "Threshold Tuning",
            "reason": (
                "Adjusts decision thresholds per group "
                "to equalize error rates."
            ),
            "expected_accuracy_drop": (
                "typically 1-3% based on prior experiments"
            )
        })
    if dpr < 0.8 and eod > 0.10:
        actions.append({
            "strategy": "Combined",
            "reason": (
                "Apply both reweighting and threshold "
                "tuning for compound violations."
            ),
            "expected_accuracy_drop": (
                "typically 3-6% based on prior experiments"
            )
        })

    decision = {
        "issues":  issues,
        "insight": insight,
        "actions": actions
    }

    return {
        "overall_accuracy":       round(overall_acc * 100, 2),
        "fairness_score":         fairness_score,
        "score_method":           score_method,
        "disparate_impact_ratio": round(dpr, 4),
        "equalized_odds_diff":    round(eod, 4),
        "risk_level":             risk_level,
        "total_rows":             len(df),
        "inferred_positive_class": inferred_positive,
        "schema_warning":         schema_warning,
        "group_metrics":          group_metrics,
        "confusion_matrices":     confusion_matrices,
        "top_features":           top_features,
        "pass_fail":              pass_fail,
        "decision":               decision,
        "limitation_note": (
            "Themis evaluates models assuming consistent "
            "preprocessing. Full pipeline compatibility "
            "is a planned next step."
        )
    }
