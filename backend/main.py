"""
main.py — FastAPI application for Themis bias analysis.

Loads model.pkl and simulation.json at startup.
Exposes 5 endpoints: /analyze, /proxy-graph, /simulate, /explain, /analyze-model
"""

import os
import json
import pickle
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from analyzer import analyze_dataset
from proxy_graph import build_proxy_graph
from simulator import get_simulation_data
from model_evaluator import evaluate_model
from gemini import explain_bias

# Load environment variables
load_dotenv()

# --- Module-level variables loaded at startup ---
model = None
simulation_data = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model and simulation data once at startup."""
    global model, simulation_data

    model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
    sim_path = os.path.join(os.path.dirname(__file__), "simulation.json")

    with open(model_path, "rb") as f:
        model = pickle.load(f)

    with open(sim_path, "r") as f:
        simulation_data = json.load(f)

    print("[OK] model.pkl and simulation.json loaded at startup")
    yield


app = FastAPI(
    title="Themis API",
    description="AI Fairness Debugger — detect bias, surface proxies, simulate mitigations",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Models ---


class ExplainRequest(BaseModel):
    fairness_score: float
    disparate_impact_ratio: float
    equalized_odds_diff: float
    top_proxy_feature: str
    protected_attr: str
    chosen_strategy: str


# --- Endpoints ---


@app.post("/analyze")
async def analyze_endpoint(
    csv_file: UploadFile = File(...),
    protected_attr: str = Form(...),
    target_col: str = Form(...),
):
    """Analyze a dataset for fairness bias."""
    csv_bytes = await csv_file.read()
    result = analyze_dataset(csv_bytes, protected_attr, target_col, model)
    return result


@app.post("/proxy-graph")
async def proxy_graph_endpoint(
    csv_file: UploadFile = File(...),
    protected_attr: str = Form(...),
):
    """Build a proxy influence graph based on mutual information."""
    csv_bytes = await csv_file.read()
    result = build_proxy_graph(csv_bytes, protected_attr)
    return result


@app.get("/simulate")
async def simulate_endpoint():
    """Return pre-loaded simulation data for trade-off curves."""
    return get_simulation_data(simulation_data)


@app.post("/explain")
async def explain_endpoint(payload: ExplainRequest):
    """Generate a Gemini-powered plain-English bias explanation."""
    result = explain_bias(payload.model_dump())
    return result


@app.post("/analyze-model")
async def analyze_model_endpoint(
    model_file: UploadFile = File(...),
    csv_file: UploadFile = File(...),
    protected_attr: str = Form(...),
    target_col: str = Form(...),
):
    """Evaluate an uploaded model for fairness on a provided dataset."""
    model_bytes = await model_file.read()
    csv_bytes = await csv_file.read()
    result = evaluate_model(model_bytes, csv_bytes, protected_attr, target_col)
    return result
