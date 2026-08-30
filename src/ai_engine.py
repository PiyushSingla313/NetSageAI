"""
NetSage AI - AI Diagnosis Engine
===================================
Wraps a call to an LLM (Gemini by default, easily swapped) using the
prompt library in prompts/diagnose_prompt.md. Forces structured JSON
output and validates it before returning a Diagnosis object.

If no API key is configured, or the API call fails/rate-limits, this
falls back to a fully offline heuristic engine so the rest of the
pipeline (dashboard, CLI, evaluator) always has something to work
with. The fallback is intentionally simple and lower-confidence than
a real model call -- it exists for reliability, not accuracy.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Optional

from .models import Case, Diagnosis

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "diagnose_prompt.md"

# Load variables from a .env file at the project root into os.environ, if
# python-dotenv is installed and a .env file exists. Without this, .env is
# just an inert text file -- os.environ.get() only sees real environment
# variables, never file contents, unless something loads them first.
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

try:
    import google.generativeai as genai  # type: ignore
    _HAS_GEMINI = True
except ImportError:
    _HAS_GEMINI = False


def _load_system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


def _build_user_prompt(case: Case, rule_findings: list) -> str:
    findings_text = "\n".join(f"- [{f['rule_id']}] {f['message']}" for f in rule_findings) or "(none triggered)"
    return (
        f"SYMPTOM: {case.symptom}\n"
        f"DOMAIN: {case.domain} ({case.osi_layer_name})\n"
        f"CLI EVIDENCE:\n{case.cli_snippet}\n\n"
        f"RULE CHECKER FINDINGS (pre-verified, treat as confirmed facts if present):\n{findings_text}\n\n"
        f"Return only the JSON object described in the schema."
    )


def _extract_json(raw_text: str) -> dict:
    """Models sometimes wrap JSON in markdown fences despite instructions."""
    cleaned = re.sub(r"```(?:json)?|```", "", raw_text).strip()
    return json.loads(cleaned)


def _call_gemini(system_prompt: str, user_prompt: str, api_key: Optional[str] = None) -> Optional[dict]:
    api_key = api_key or os.environ.get("GEMINI_API_KEY")
    model_name = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
    if not api_key or not _HAS_GEMINI:
        return None
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name, system_instruction=system_prompt)
        response = model.generate_content(user_prompt)
        return _extract_json(response.text)
    except Exception as exc:  # noqa: BLE001 - deliberately broad, this is a fallback boundary
        print(f"[ai_engine] Gemini call failed, falling back to offline engine: {exc}")
        return None


# ---------------------------------------------------------------------------
# Offline fallback: heuristic, rule-informed diagnosis with NO external call.
# ---------------------------------------------------------------------------

_KEYWORD_ROOT_CAUSES = {
    "administratively down": "The interface referenced in the evidence has been administratively shut down.",
    "err-disabled": "A port security or other violation has placed the interface into an err-disabled state.",
    "native vlan mismatch": "A native VLAN mismatch exists on the trunk link described in the evidence.",
    "leased addresses": "The DHCP pool referenced in the evidence appears to be exhausted.",
    "ip helper-address": "DHCP relay is likely missing on the routed interface described in the evidence.",
    "area 1": "An OSPF area mismatch is likely blocking the neighbor adjacency described in the evidence.",
    "deny ip any any": "An overly broad access-list entry is blocking legitimate traffic.",
    "duplicate": "A duplicate IP address assignment is causing the conflict described in the evidence.",
    "no route to": "The routing table is missing an entry for the destination described in the evidence.",
    "half-duplex": "A duplex mismatch between the two ends of the link is likely causing the errors shown.",
    "state: idle": "A BGP session parameter (likely the remote AS number) does not match what the peer expects.",
}


def _offline_diagnose(case: Case, rule_findings: list) -> Diagnosis:
    evidence_text = case.evidence_text().lower()

    if rule_findings:
        top = rule_findings[0]
        root_cause = top["message"]
        confidence = "medium"
        evidence = top["evidence"]
    else:
        root_cause = "Unable to confirm a specific root cause from the available evidence without model access."
        confidence = "low"
        evidence = case.cli_snippet.strip().splitlines()[0] if case.cli_snippet.strip() else "(no evidence provided)"
        for keyword, guess in _KEYWORD_ROOT_CAUSES.items():
            if keyword in evidence_text:
                root_cause = guess
                confidence = "low"
                break

    return Diagnosis(
        case_id=case.case_id,
        root_cause=root_cause,
        confidence=confidence,
        evidence=evidence,
        next_command="show running-config (re-verify manually; offline engine has limited context)",
        fix_steps=[
            "Re-run this case with GEMINI_API_KEY configured for a fully reasoned diagnosis.",
            "In the meantime, manually verify the flagged evidence against the case's expected_fault.",
        ],
        source="offline_fallback",
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def diagnose(case: Case, rule_findings: list, api_key: Optional[str] = None) -> Diagnosis:
    """Diagnose a single case. Tries the LLM first, falls back to offline heuristics.

    api_key, if given, takes precedence over the GEMINI_API_KEY environment
    variable. A missing or invalid key (or any other API failure) is
    caught in _call_gemini and results in the offline fallback below --
    it never raises.
    """
    system_prompt = _load_system_prompt()
    user_prompt = _build_user_prompt(case, rule_findings)

    result = _call_gemini(system_prompt, user_prompt, api_key)
    if result is not None:
        try:
            return Diagnosis(
                case_id=case.case_id,
                root_cause=result["root_cause"],
                confidence=result["confidence"],
                evidence=result["evidence"],
                next_command=result["next_command"],
                fix_steps=list(result["fix_steps"]),
                source="ai",
            )
        except (KeyError, TypeError) as exc:
            print(f"[ai_engine] Malformed AI JSON ({exc}), falling back to offline engine.")

    return _offline_diagnose(case, rule_findings)
