import json
import math

with open("simulation.json", "r") as f:
    data = json.load(f)

# Update baseline
data["baseline"] = {
    "accuracy": 87.49,
    "fairness": 33.2,
    "disparate_impact": 0.3317,
    "equalized_odds_diff": 0.0703
}

reweighting = []
for i in range(25):
    intensity = i / 24.0
    # Custom curve for reweighting
    if intensity <= 0.6:
        t = intensity / 0.6
        # bezier curve for fairness? Simple linear to knee point works too, or a smooth quadratic
        fairness = 33.2 + (78.0 - 33.2) * (t ** 0.8)
        accuracy = 87.5 - (87.5 - 86.0) * (t ** 1.5)
    else:
        t = (intensity - 0.6) / 0.4
        fairness = 78.0 + (84.0 - 78.0) * (t ** 1.2)
        accuracy = 86.0 - (86.0 - 83.0) * (t ** 0.8)
    
    reweighting.append({
        "intensity": round(intensity, 2),
        "fairness": round(fairness, 1),
        "accuracy": round(accuracy, 1)
    })

data["reweighting"] = reweighting

# Threshold endpoints: 33.2 to 76.0 fairness, 87.5 to 85.5% accuracy
threshold = []
for i in range(25):
    intensity = i / 24.0
    fairness = 33.2 + (76.0 - 33.2) * intensity
    accuracy = 87.5 - (87.5 - 85.5) * intensity
    
    threshold.append({
        "intensity": round(intensity, 2),
        "fairness": round(fairness, 1),
        "accuracy": round(accuracy, 1)
    })
data["threshold"] = threshold

with open("simulation.json", "w") as f:
    json.dump(data, f, indent=2)
print("Updated simulation.json")
