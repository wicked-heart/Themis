"""
proxy_graph.py — Builds a proxy influence graph showing mutual information
between features and the protected attribute.
"""

import io
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.feature_selection import mutual_info_classif


def build_proxy_graph(csv_bytes: bytes, protected_attr: str):
    """
    Compute mutual information between every feature and the
    protected attribute, returning a node/edge graph structure
    for the top 6 features.
    """
    df = pd.read_csv(io.BytesIO(csv_bytes))

    # Clean column names
    df.columns = [c.strip().lower().replace("-", "_") for c in df.columns]
    protected_attr = protected_attr.strip().lower().replace("-", "_")

    df = df.dropna().reset_index(drop=True)

    # Encode all categoricals
    for col in df.select_dtypes(include=["object", "category"]).columns:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))

    # Target is the protected attribute
    y = df[protected_attr]
    X = df.drop(columns=[protected_attr])

    # Compute mutual information
    mi_scores = mutual_info_classif(X, y, random_state=42)
    feature_names = X.columns.tolist()

    # Sort by MI, take top 6
    scored = list(zip(feature_names, mi_scores))
    scored.sort(key=lambda x: x[1], reverse=True)
    top_6 = scored[:6]

    # Find dominant edge
    max_mi = top_6[0][1] if top_6 else 0

    # Build nodes
    nodes = [{"id": protected_attr, "type": "protected"}]
    for feat, mi in top_6:
        nodes.append({
            "id": feat,
            "type": "feature",
            "mi_score": round(float(mi), 2),
        })

    # Build edges
    edges = []
    for feat, mi in top_6:
        mi_val = round(float(mi), 2)

        # Color based on MI score
        if mi > 0.6:
            color = "red"
        elif mi > 0.4:
            color = "amber"
        else:
            color = "gray"

        is_dominant = abs(mi - max_mi) < 1e-6

        edge = {
            "source": protected_attr,
            "target": feat,
            "mi_score": mi_val,
            "color": color,
            "callout": is_dominant,
        }

        if is_dominant:
            edge["label"] = f"Strongest statistical association (MI: {mi_val})"

        edges.append(edge)

    # Convert numpy types to native Python for JSON serialization
    def convert(obj):
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        return obj

    nodes = [{k: convert(v) for k, v in node.items()} for node in nodes]
    edges = [{k: convert(v) for k, v in edge.items()} for edge in edges]

    return {"nodes": nodes, "edges": edges}
