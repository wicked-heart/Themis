"""
export_full_adult.py — Downloads the full UCI Adult dataset
and saves it as adult_full.csv for use in Themis.
"""

import pandas as pd
from sklearn.datasets import fetch_openml

print("[1/3] Fetching full UCI Adult dataset from OpenML...")
data = fetch_openml("adult", version=2, as_frame=True, parser="auto")
df = data.frame

print(f"[2/3] Dataset loaded: {len(df)} rows, {len(df.columns)} columns")

# Save as CSV
output_path = "../adult_full.csv"
df.to_csv(output_path, index=False)

print(f"[3/3] Saved to {output_path}")
print(f"       Columns: {list(df.columns)}")
print(f"       Shape: {df.shape}")
