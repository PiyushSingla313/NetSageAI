"""Domain models shared across the rule checker, AI engine, CLI, and evaluator."""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import List, Optional


@dataclass
class Case:
    case_id: str
    timestamp: str
    domain: str
    osi_layer: str
    osi_layer_name: str
    symptom: str
    cli_snippet: str
    root_cause: str
    confidence: str
    confidence_tier: str
    next_command_device: str
    next_command_cmd: str
    fix_step_1: str
    fix_step_2: str
    fix_step_3: str
    outcome: str

    def evidence_text(self) -> str:
        """Combined text the rule checker and AI engine scan for signatures."""
        return f"{self.symptom}\n{self.cli_snippet}"

    def fix_steps(self) -> List[str]:
        return [s for s in (self.fix_step_1, self.fix_step_2, self.fix_step_3) if s]

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Diagnosis:
    case_id: str
    root_cause: str
    confidence: str  # low | medium | high
    evidence: str
    next_command: str
    fix_steps: List[str]
    source: str = "ai"  # "ai" or "offline_fallback"

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ReviewRecord:
    case_id: str
    decision: str  # "accepted" | "edited" | "rejected"
    reviewer: str
    notes: str = ""
    corrected_root_cause: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class CaseResult:
    """A fully processed case: rule findings + AI diagnosis + human review."""
    case: Case
    rule_triggered: bool
    rule_findings: List[dict] = field(default_factory=list)
    diagnosis: Optional[Diagnosis] = None
    review: Optional[ReviewRecord] = None

    def to_dict(self) -> dict:
        return {
            "case": self.case.to_dict(),
            "rule_triggered": self.rule_triggered,
            "rule_findings": self.rule_findings,
            "diagnosis": self.diagnosis.to_dict() if self.diagnosis else None,
            "review": self.review.to_dict() if self.review else None,
        }
