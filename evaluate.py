#!/usr/bin/env python3
"""
NetSage AI - Automated Benchmark Evaluator
==============================================
Runs every case in dataset/cases.csv through the rule checker and AI
engine, scores diagnostic accuracy against expected_fault, and reports
on human review agreement if dataset/review_log.json exists.

Usage:
    python evaluate.py
    python evaluate.py --export dataset/evaluation_results.json
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

from checker.rule_checker import run_rule_checks
from src.ai_engine import diagnose
from src.models import Case

ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "dataset" / "cases.csv"
REVIEW_LOG_PATH = ROOT / "dataset" / "review_log.json"

# A small set of stopwords so keyword overlap isn't dominated by "the/a/is" etc.
_STOPWORDS = {
    "the", "a", "an", "is", "are", "to", "of", "and", "on", "in", "for",
    "with", "this", "that", "so", "so,", "so.", "instead", "than", "its",
}


def _keywords(text: str) -> set[str]:
    words = re.findall(r"[a-zA-Z0-9./-]+", text.lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 2}


def _root_cause_matches(expected: str, actual: str) -> bool:
    """Loose keyword-overlap match; a real submission would use a stronger
    semantic similarity check, but this keeps the evaluator dependency-free."""
    expected_kw = _keywords(expected)
    actual_kw = _keywords(actual)
    if not expected_kw:
        return False
    overlap = expected_kw & actual_kw
    return len(overlap) / len(expected_kw) >= 0.25


def load_cases() -> list[Case]:
    cases = []
    with open(DATASET_PATH, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cases.append(Case(**row))
    return cases


def load_review_log() -> dict[str, dict]:
    if not REVIEW_LOG_PATH.exists():
        return {}
    entries = json.loads(REVIEW_LOG_PATH.read_text(encoding="utf-8"))
    return {e["case_id"]: e for e in entries}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--export", help="Path to write full JSON results to")
    args = parser.parse_args()

    cases = load_cases()
    reviews = load_review_log()

    rule_hits = 0
    ai_correct = 0
    evidence_grounded = 0
    results = []

    for case in cases:
        rule_result = run_rule_checks(case.case_id, case.evidence_text())
        if rule_result.triggered:
            rule_hits += 1

        diag = diagnose(case, [f.__dict__ for f in rule_result.findings])

        is_correct = _root_cause_matches(case.root_cause, diag.root_cause)
        if is_correct:
            ai_correct += 1

        # "Evidence grounded" = the diagnosis's evidence field is a
        # substring found in the case's actual show_output/topology note,
        # i.e. the model didn't invent evidence.
        grounded = diag.evidence.strip().lower() in case.evidence_text().lower() if diag.evidence else False
        if grounded:
            evidence_grounded += 1

        review = reviews.get(case.case_id)

        results.append({
            "case_id": case.case_id,
            "domain": case.domain,
            "osi_layer": case.osi_layer,
            "rule_triggered": rule_result.triggered,
            "ai_root_cause": diag.root_cause,
            "ai_confidence": diag.confidence,
            "ai_source": diag.source,
            "expected_root_cause": case.root_cause,
            "root_cause_match": is_correct,
            "evidence_grounded": grounded,
            "review_decision": review["decision"] if review else None,
        })

    total = len(cases)
    reviewed = [r for r in results if r["review_decision"]]
    accepted = sum(1 for r in reviewed if r["review_decision"] == "accepted")
    edited = sum(1 for r in reviewed if r["review_decision"] == "edited")
    rejected = sum(1 for r in reviewed if r["review_decision"] == "rejected")

    print("=" * 64)
    print("        NetSage AI Diagnostic Benchmark Suite")
    print("=" * 64)
    print(f"[+] Total Lab Scenarios Evaluated : {total}")
    print(f"[+] Rule Engine Trigger Rate       : {rule_hits/total*100:.1f}%  ({rule_hits}/{total})")
    print(f"[+] AI Root Cause Diagnostic Score : {ai_correct/total*100:.1f}%  ({ai_correct}/{total})")
    print(f"[+] Evidence Grounding Rate        : {evidence_grounded/total*100:.1f}%  ({evidence_grounded}/{total})")
    if reviewed:
        print(f"[+] Human Agreement Rate           : {accepted/len(reviewed)*100:.1f}%  ({accepted}/{len(reviewed)} reviewed)")
        print("\n--- Human Review Breakdown ---")
        print(f"    Approved / Accepted : {accepted}")
        print(f"    Human Corrected     : {edited}")
        print(f"    Rejected            : {rejected}")
    else:
        print("[!] No review_log.json found yet — run netsage_cli.py or the")
        print("    web dashboard to record human review decisions.")
    print("=" * 64)

    if args.export:
        Path(args.export).write_text(json.dumps(results, indent=2), encoding="utf-8")
        print(f"\nFull results written to {args.export}")


if __name__ == "__main__":
    main()
