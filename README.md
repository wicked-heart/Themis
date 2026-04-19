# Themis — AI Fairness Debugger

> Detect bias in datasets and trained models, surface proxy features driving discrimination, simulate mitigation trade-offs, and get plain-English explanations powered by Gemini 2.5 Flash.

![Themis](https://img.shields.io/badge/Themis-v1.0-6366f1)
![Python](https://img.shields.io/badge/Python-3.11-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React + Vite + Vanilla CSS            │
│                                                         │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌────────┐   │
│  │ Upload  │→ │ Metrics  │→ │  Graph    │→ │Simulate│   │
│  │ Panel   │  │Dashboard │  │(ReactFlow)│  │(Charts)│   │
│  └─────────┘  └──────────┘  └───────────┘  └────────┘   │
│                                                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐            │
│  │  Model    │→ │  Model    │→ │Calibration│            │
│  │  Upload   │  │  Metrics  │  │  Curves   │            │
│  └───────────┘  └───────────┘  └───────────┘            │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API
┌───────────────────────┴─────────────────────────────────┐
│                    FastAPI Backend                      │
│                                                         │
│  /analyze      — Bias detection + SHAP analysis         │
│  /proxy-graph  — Mutual information proxy graph         │
│  /simulate     — Trade-off Pareto curves                │
│  /explain      — Gemini 1.5 Flash explanations          │
│  /analyze-model — Model fairness evaluation             │
│                                                         │
│  Libraries: fairlearn, shap, xgboost, scikit-learn      │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Gemini API key (for `/explain` endpoint)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Generate model.pkl and simulation.json (first time only)
python generate_artifacts.py

# Set your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies API calls to the backend at `http://localhost:8080`.

## Environment Variables

| Variable         | Location        | Description           |
|------------------|-----------------|-----------------------|
| `GEMINI_API_KEY` | `backend/.env`  | Google Gemini API key |
| `VITE_API_URL`   | `frontend/.env` | Backend API base URL  |

## API Endpoints

| Method | Path             | Description                     |
|--------|------------------|---------------------------------|
| POST   | `/analyze`       | Analyze dataset for bias        |
| POST   | `/proxy-graph`   | Build proxy influence graph     |
| GET    | `/simulate`      | Get trade-off simulation data   |
| POST   | `/explain`       | Get Gemini bias explanation     |
| POST   | `/analyze-model` | Evaluate model fairness         |

## Deployment

### Backend (Google Cloud Run)

```bash
cd backend
gcloud builds submit --tag gcr.io/PROJECT_ID/themis-api
gcloud run deploy themis-api --image gcr.io/PROJECT_ID/themis-api --port 8080
```

### Frontend (Firebase Hosting)

```bash
cd frontend
npm run build
firebase deploy --only hosting
```