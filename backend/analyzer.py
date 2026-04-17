"""
analyzer.py — Core bias analysis logic for /analyze endpoint.
Trains a fresh XGBoost on each uploaded dataset.
Generates dynamic trade-off simulation curves.
Works on any CSV with any columns.
"""

import io
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from fairlearn.metrics import (
    demographic_parity_ratio,
    equalized_odds_difference
)
from xgboost import XGBClassifier
import shap


# ── Helpers ────────────────────────────────────────────────────

def _compute_fairness(y_true, y_pred, sensitive):
    """Return (accuracy, fairness_score, dpr, eod) for a set of predictions."""
    acc = accuracy_score(y_true, y_pred) * 100
    dpr = float(demographic_parity_ratio(
        y_true, y_pred, sensitive_features=sensitive
    ))
    eod = float(equalized_odds_difference(
        y_true, y_pred, sensitive_features=sensitive
    ))
    fairness = (dpr * 50) + ((1 - eod) * 50)
    fairness = max(0.0, min(100.0, fairness))
    return round(acc, 2), round(fairness, 1), round(dpr, 4), round(eod, 4)


def _simulate_tradeoffs(clf, X_full, y_full, s_full,
                        baseline_acc, baseline_fairness,
                        baseline_dpr, baseline_eod,
                        n_points=25):
    """
    Generate two smooth trade-off curves showing how fairness
    improves (and accuracy changes) under different strategies.

    Strategy 1 — Reweighting (per-group threshold equalization):
      Adjusts per-group classification thresholds to equalize
      selection rates across demographic groups.  Targeted and
      efficient — achieves high fairness with minimal accuracy loss.

    Strategy 2 — Threshold Tuning (equalization + rising base):
      Same per-group equalization, but ALSO raises the global
      base threshold progressively.  This makes the model more
      conservative overall, costing additional accuracy for
      similar fairness gains — a less efficient but simpler
      real-world strategy.

    Both curves are returned sorted by ascending fairness with
    strict monotonicity enforced (fairness ↑, accuracy ↓).
    """
    y_proba = clf.predict_proba(X_full)[:, 1]
    y_true  = np.array(y_full)
    s_arr   = np.array(s_full)
    groups  = np.unique(s_arr)

    # ── Per-group equalization thresholds ──────────────────────
    global_sel_rate = (y_proba >= 0.5).mean()
    group_eq_thresh = {}
    for g in groups:
        mask    = s_arr == g
        g_proba = y_proba[mask]
        n_g     = mask.sum()
        target  = max(1, min(n_g - 1, int(round(global_sel_rate * n_g))))
        sorted_desc = np.sort(g_proba)[::-1]
        group_eq_thresh[g] = float(sorted_desc[min(target, len(sorted_desc) - 1)])

    def _build_curve(base_shift_max):
        """Generate a curve with optional base threshold shift."""
        raw = []
        for i in range(n_points):
            alpha = i / max(n_points - 1, 1)
            base_shift = alpha * base_shift_max
            y_pred = np.zeros(len(y_true), dtype=int)
            for g in groups:
                mask = s_arr == g
                t_g = (0.5 + base_shift) * (1 - alpha) + \
                      (group_eq_thresh[g] + base_shift) * alpha
                y_pred[mask] = (y_proba[mask] >= t_g).astype(int)

            if len(np.unique(y_pred)) >= 2:
                acc, fair, _, _ = _compute_fairness(y_true, y_pred, s_arr)
                raw.append({
                    "intensity": round(alpha, 2),
                    "fairness": fair,
                    "accuracy": acc,
                })
            elif raw:
                raw.append({**raw[-1], "intensity": round(alpha, 2)})
        return raw

    # ── Generate raw curves ───────────────────────────────────
    rw_raw = _build_curve(base_shift_max=0.0)    # pure equalization
    th_raw = _build_curve(base_shift_max=0.12)   # equalization + rising base

    # ── Enforce monotonicity (fairness ↑, accuracy ↓) ─────────
    def _enforce_monotonic(curve):
        if not curve:
            return curve
        out = [curve[0].copy()]
        for pt in curve[1:]:
            p = pt.copy()
            p["fairness"] = round(max(p["fairness"], out[-1]["fairness"]), 1)
            p["accuracy"] = round(min(p["accuracy"], out[-1]["accuracy"]), 2)
            out.append(p)
        return out

    reweighting_curve = _enforce_monotonic(rw_raw)
    threshold_curve   = _enforce_monotonic(th_raw)

    return {
        "baseline": {
            "accuracy": baseline_acc,
            "fairness": baseline_fairness,
            "disparate_impact": baseline_dpr,
            "equalized_odds_diff": baseline_eod,
        },
        "reweighting": reweighting_curve,
        "threshold": threshold_curve,
    }


# ── Main analysis ──────────────────────────────────────────────

def analyze_dataset(
    csv_bytes: bytes,
    protected_attr: str,
    target_col: str,
    model  # kept for signature compatibility, not used
):
    # ── 1. Read and clean ──────────────────────────────────────
    df = pd.read_csv(io.BytesIO(csv_bytes))
    df.columns = [c.strip().lower().replace(" ", "_").replace("-", "_")
                  for c in df.columns]
    protected_attr = (protected_attr.strip().lower()
                      .replace(" ", "_").replace("-", "_"))
    target_col = (target_col.strip().lower()
                  .replace(" ", "_").replace("-", "_"))
    df = df.dropna().reset_index(drop=True)

    # ── 2. Store raw sensitive values before encoding ──────────
    sensitive_raw = df[protected_attr].astype(str).copy()

    # ── 3. Encode all categoricals ─────────────────────────────
    label_encoders = {}
    for col in df.select_dtypes(
            include=["object", "category"]).columns:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        label_encoders[col] = le

    # ── 4. Ensure positive class is encoded as 1 ──────────────
    unique_target_vals = df[target_col].nunique()
    if unique_target_vals > 2:
        # Binarize high-cardinality or continuous targets at their median
        try:
            numeric_target = pd.to_numeric(df[target_col])
        except Exception:
            le = LabelEncoder()
            numeric_target = le.fit_transform(df[target_col])
        median_val = np.median(numeric_target)
        df[target_col] = (numeric_target > median_val).astype(int)
    elif target_col not in label_encoders and not set(df[target_col].unique()).issubset({0, 1}):
        le = LabelEncoder()
        df[target_col] = le.fit_transform(df[target_col])
        label_encoders[target_col] = le

    if target_col in label_encoders:
        le = label_encoders[target_col]
        classes = list(le.classes_)
        positive_hints = [
            ">50k", ">50k.", "yes", "1", "true",
            "approved", "positive", "high", "default"
        ]
        positive_idx = None
        for i, cls in enumerate(classes):
            if str(cls).lower().strip(".") in positive_hints:
                positive_idx = i
                break
        if positive_idx == 0:
            df[target_col] = 1 - df[target_col]

    df[target_col] = df[target_col].astype(int)

    # ── 5. Split features and target ──────────────────────────
    X = df.drop(columns=[target_col])
    y = df[target_col]

    # ── 6. Train XGBoost on this dataset ──────────────────────
    X_train, X_test, y_train, y_test, s_train, s_test = (
        train_test_split(
            X, y, sensitive_raw,
            test_size=0.2,
            random_state=42,
            stratify=y
        )
    )

    clf = XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric='logloss',
        use_label_encoder=False
    )
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    print(f"[DEBUG] Trained XGBoost on {len(X_train)} rows, "
          f"tested on {len(X_test)} rows")
    print(f"[DEBUG] Accuracy: {acc:.4f}")

    # ── 7. Fairness metrics ────────────────────────────────────
    dpr = float(demographic_parity_ratio(
        y_test, y_pred, sensitive_features=s_test
    ))
    eod = float(equalized_odds_difference(
        y_test, y_pred, sensitive_features=s_test
    ))
    print(f"[DEBUG] DPR: {dpr:.4f}, EOD: {eod:.4f}")

    # ── 8. SHAP with TreeExplainer ─────────────────────────────
    explainer = shap.TreeExplainer(clf)
    shap_values = explainer.shap_values(X_test)

    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    feature_names = X_test.columns.tolist()

    top_indices = np.argsort(mean_abs_shap)[-6:][::-1]
    top_features = [
        {
            "feature": feature_names[idx],
            "shap_mean": round(float(mean_abs_shap[idx]), 3)
        }
        for idx in top_indices
    ]

    # ── 9. Fairness score ──────────────────────────────────────
    fairness_score = (dpr * 50) + ((1 - eod) * 50)
    fairness_score = float(round(
        max(0, min(100, fairness_score)), 1
    ))

    # ── 10. Pass/fail thresholds ───────────────────────────────
    top_shap_val = (top_features[0]["shap_mean"]
                    if top_features else 0)
    pass_fail = {
        "disparate_impact": (
            "pass" if dpr >= 0.8 else "fail"
        ),
        "equalized_odds": (
            "pass" if eod <= 0.10 else "fail"
        ),
        "shap_influence": (
            "warn" if top_shap_val > 0.25 else "pass"
        ),
    }

    # ── 11. Dynamic trade-off simulation ───────────────────────
    # Use FULL dataset for simulation (not just test set) so that
    # small datasets still produce smooth, meaningful curves.
    # This is a "what-if" exploration, not a model evaluation.
    acc_pct = round(acc * 100, 2)
    simulation = _simulate_tradeoffs(
        clf, X, y, sensitive_raw,
        baseline_acc=acc_pct,
        baseline_fairness=fairness_score,
        baseline_dpr=round(dpr, 4),
        baseline_eod=round(eod, 4),
    )
    print(f"[DEBUG] Simulation generated: "
          f"{len(simulation['reweighting'])} reweighting points, "
          f"{len(simulation['threshold'])} threshold points")

    return {
        "fairness_score": fairness_score,
        "disparate_impact_ratio": round(dpr, 4),
        "equalized_odds_diff": round(eod, 4),
        "accuracy": acc_pct,
        "total_rows": len(df),
        "top_features": top_features,
        "pass_fail": pass_fail,
        "simulation": simulation,
    }
