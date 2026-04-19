"""
gemini.py — Calls Gemini 2.5 Flash to generate plain-English
explanations of AI bias patterns using the google.genai SDK.
"""

import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def explain_bias(payload: dict) -> dict:
    """
    Generate a plain-English explanation of a bias pattern
    using Gemini 2.5 Flash.

    payload keys:
      - fairness_score
      - disparate_impact_ratio
      - equalized_odds_diff
      - top_proxy_feature
      - protected_attr
      - chosen_strategy
    """
    prompt = f"""You are a fairness auditor explaining \
AI bias to a compliance team. Write exactly 3 sentences. \
No bullets. No headers.
Sentence 1: What this bias pattern means given disparate \
impact ratio of {payload['disparate_impact_ratio']} and \
equalized odds difference of {payload['equalized_odds_diff']}.
Sentence 2: Why {payload['top_proxy_feature']} shows a \
strong statistical association with {payload['protected_attr']} \
and why this is problematic.
Sentence 3: Why {payload['chosen_strategy']} is the \
appropriate mitigation given this specific pattern.
Be specific. Avoid jargon. No causal claims. Write for \
a non-technical compliance officer."""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return {"explanation": response.text}
    except Exception as e:
        return {"explanation": f"Gemini error: {str(e)}"}
