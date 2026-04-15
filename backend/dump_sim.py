import requests, json

files = {
    'csv_file': ('f', open(r'C:\Users\Musamuraaz\Desktop\Themis\adult_full.csv', 'rb'), 'text/csv')
}
r = requests.post('http://127.0.0.1:8000/analyze', files=files, data={
    'protected_attr': 'race',
    'target_col': 'class'
})
sim = r.json()['simulation']

print("=== REWEIGHTING ===")
for p in sim['reweighting']:
    print(f"  i={p['intensity']:.2f}  fair={p['fairness']:6.1f}  acc={p['accuracy']:6.2f}")

print("\n=== THRESHOLD ===")
for p in sim['threshold']:
    print(f"  i={p['intensity']:.2f}  fair={p['fairness']:6.1f}  acc={p['accuracy']:6.2f}")

print(f"\nBaseline: fair={sim['baseline']['fairness']}, acc={sim['baseline']['accuracy']}")
