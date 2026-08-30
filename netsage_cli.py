#!/usr/bin/env python3
"""
NetSage AI - Interactive Terminal Workbench
==============================================
Pick a case, see the evidence, see the rule checker's findings, see the
AI's proposed diagnosis, and record a human review decision
(accept / edit / reject). This is the human-in-the-loop safety gate --
no diagnosis is ever treated as final until a human has reviewed it
here (or in the web dashboard).

Review decisions are appended to dataset/review_log.json.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from checker.rule_checker import run_rule_checks
from src.ai_engine import diagnose
from src.models import Case, ReviewRecord

ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "dataset" / "cases.csv"
REVIEW_LOG_PATH = ROOT / "dataset" / "review_log.json"


def load_cases() -> list[Case]:
    cases = []
    with open(DATASET_PATH, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cases.append(Case(**row))
    return cases


def load_review_log() -> list[dict]:
    if REVIEW_LOG_PATH.exists():
        return json.loads(REVIEW_LOG_PATH.read_text(encoding="utf-8"))
    return []


def save_review(record: ReviewRecord) -> None:
    log = load_review_log()
    log = [r for r in log if r["case_id"] != record.case_id]  # replace prior review of same case
    log.append(record.to_dict())
    REVIEW_LOG_PATH.write_text(json.dumps(log, indent=2), encoding="utf-8")


def print_case(case: Case) -> None:
    print("\n" + "=" * 70)
    print(f" {case.case_id}  |  {case.domain}  |  L{case.osi_layer} {case.osi_layer_name}  |  Confidence tier: {case.confidence_tier}")
    print("=" * 70)
    print(f"Symptom:\n  {case.symptom}\n")
    print(f"CLI evidence:\n{case.cli_snippet}\n")


def review_flow(case: Case) -> None:
    rule_result = run_rule_checks(case.case_id, case.evidence_text())
    print(f"Rule checker: {'TRIGGERED' if rule_result.triggered else 'clean'} "
          f"({len(rule_result.findings)} finding(s))")
    for f in rule_result.findings:
        print(f"  - [{f.rule_id}] {f.message}")

    diag = diagnose(case, [f.__dict__ for f in rule_result.findings])
    print(f"\nAI diagnosis (source={diag.source}, confidence={diag.confidence}):")
    print(f"  Root cause : {diag.root_cause}")
    print(f"  Evidence   : {diag.evidence}")
    print(f"  Next cmd   : {diag.next_command}")
    print(f"  Fix steps  :")
    for step in diag.fix_steps:
        print(f"    - {step}")

    print(f"\nRoot cause (ground truth): {case.root_cause}")

    print("\nHuman review — Accept / Edit / Reject the AI diagnosis?")
    decision_input = input("  [A]ccept  [E]dit  [R]eject  > ").strip().lower()

    reviewer = input("  Your name/initials: ").strip() or "anonymous"
    notes = ""
    corrected = None

    if decision_input.startswith("e"):
        decision = "edited"
        corrected = input("  Corrected root cause: ").strip()
        notes = input("  Notes on the correction: ").strip()
    elif decision_input.startswith("r"):
        decision = "rejected"
        notes = input("  Why was this rejected?: ").strip()
    else:
        decision = "accepted"
        notes = input("  Optional notes (press Enter to skip): ").strip()

    record = ReviewRecord(
        case_id=case.case_id,
        decision=decision,
        reviewer=reviewer,
        notes=notes,
        corrected_root_cause=corrected,
    )
    save_review(record)
    print(f"\n✓ Review saved: {decision.upper()} by {reviewer}\n")


def main() -> None:
    cases = load_cases()
    while True:
        print("\nNetSage AI — Terminal Workbench")
        print(f"{len(cases)} cases loaded. Enter a case ID (e.g. NS-001), 'list', or 'q' to quit.")
        choice = input("> ").strip()

        if choice.lower() == "q":
            break
        if choice.lower() == "list":
            for c in cases:
                print(f"  {c.case_id}  {c.domain:20s} {c.symptom[:60]}")
            continue

        match = next((c for c in cases if c.case_id.lower() == choice.lower()), None)
        if not match:
            print("Case not found. Try 'list' to see valid IDs.")
            continue

        print_case(match)
        review_flow(match)


if __name__ == "__main__":
    main()
