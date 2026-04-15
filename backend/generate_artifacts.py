"""
One-time script to generate model.pkl and simulation.json
using the UCI Adult Census dataset. Run once, then commit the artifacts.

Usage: python generate_artifacts.py
"""

import pickle
import json
import numpy as np
import pandas as pd
from sklearn.datasets import fetch_openml
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier
from fairlearn.metrics import MetricFrame, selection_rate, equalized_odds_difference
from sklearn.metrics import accuracy_score


def main():
    print("[1/5] Fetching UCI Adult dataset...")
    data = fetch_openml("adult", version=2, as_frame=True, parser="auto")
    df = data.frame

    # Clean column names
    df.columns = [c.strip().lower().replace("-", "_") for c in df.columns]

    # Target: class >50K = 1
    target_col = "class"
    df[target_col] = df[target_col].astype(str).str.strip().str.replace(".", "", regex=False)
    df[target_col] = (df[target_col] == ">50K").astype(int)

    protected_attr = "sex"

    # Drop rows with NaN
    df = df.dropna().reset_index(drop=True)

    # Encode categoricals
    label_encoders = {}
    for col in df.select_dtypes(include=["object", "category"]).columns:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        label_encoders[col] = le

    X = df.drop(columns=[target_col])
    y = df[target_col]
    sensitive = df[protected_attr]

    X_train, X_test, y_train, y_test, s_train, s_test = train_test_split(
        X, y, sensitive, test_size=0.2, random_state=42, stratify=y
    )

    # ----- Train XGBoost -----
    print("[2/5] Training XGBoost classifier...")
    model = XGBClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.1,
        random_state=42,
        use_label_encoder=False,
        eval_metric="logloss",
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)

    # ----- Compute baseline fairness -----
    print("[3/5] Computing baseline fairness metrics...")
    mf = MetricFrame(
        metrics=selection_rate,
        y_true=y_test,
        y_pred=y_pred,
        sensitive_features=s_test,
    )
    di_ratio = float(mf.ratio())
    eod = float(equalized_odds_difference(y_test, y_pred, sensitive_features=s_test))

    # Fairness score
    shap_component = max(0, 1 - 0.3) * 25  # placeholder shap component
    fairness_score = (di_ratio * 40) + ((1 - eod) * 35) + shap_component
    fairness_score = max(0, min(100, fairness_score))

    print(f"  Accuracy: {acc:.3f}")
    print(f"  Disparate Impact Ratio: {di_ratio:.3f}")
    print(f"  Equalized Odds Diff: {eod:.3f}")
    print(f"  Fairness Score: {fairness_score:.1f}")

    # ----- Save model -----
    print("[4/5] Saving model.pkl...")
    with open("model.pkl", "wb") as f:
        pickle.dump(model, f)

    # ----- Generate simulation data -----
    print("[5/5] Generating simulation.json...")

    baseline = {
        "accuracy": round(acc * 100, 1),
        "fairness": round(fairness_score, 1),
        "disparate_impact": round(di_ratio, 2),
        "equalized_odds_diff": round(eod, 2),
    }

    # Generate 25-point Pareto curves
    def generate_curve(strategy_name):
        points = []
        base_acc = acc * 100
        base_fair = fairness_score

        for i in range(25):
            intensity = round(i * 0.04, 2)

            if strategy_name == "reweighting":
                # Reweighting: smooth fairness gain, gradual accuracy loss
                fair_gain = 39 * (1 - np.exp(-3 * intensity))
                acc_loss = 12 * intensity ** 1.5
            else:
                # Threshold tuning: faster initial gain, steeper cost
                fair_gain = 39 * (1 - np.exp(-4 * intensity))
                acc_loss = 15 * intensity ** 1.3

            new_fair = min(100, round(base_fair + fair_gain, 1))
            new_acc = max(70, round(base_acc - acc_loss, 1))

            points.append({
                "intensity": intensity,
                "fairness": new_fair,
                "accuracy": new_acc,
            })

        return points

    simulation = {
        "baseline": baseline,
        "reweighting": generate_curve("reweighting"),
        "threshold": generate_curve("threshold"),
    }

    with open("simulation.json", "w") as f:
        json.dump(simulation, f, indent=2)

    print("Done! Files created: model.pkl, simulation.json")


if __name__ == "__main__":
    main()
