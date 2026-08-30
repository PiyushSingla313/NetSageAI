export interface Case {
  case_id: string;
  timestamp: string;
  domain: string;
  osi_layer: number; // e.g. 3
  osi_layer_name: string; // e.g. "Network"
  symptom: string;
  cli_snippet: string;
  root_cause: string;
  confidence: number; // e.g. 0.85
  confidence_tier: "low" | "medium" | "high" | string;
  next_command_device: string;
  next_command_cmd: string;
  fix_step_1: string;
  fix_step_2: string;
  fix_step_3: string;
  outcome: string;
}

export interface RuleFinding {
  rule_id: string;
  concept_tag: string;
  message: string;
  evidence: string;
}

export interface Diagnosis {
  root_cause: string;
  confidence: "low" | "medium" | "high";
  evidence: string;
  next_command: string;
  fix_steps: string[];
  source: "ai" | "offline_fallback";
}

export type ReviewDecision = "accepted" | "edited" | "rejected" | null;

export interface ReviewRecord {
  case_id: string;
  decision: ReviewDecision;
  reviewer: string;
  notes: string;
  corrected_root_cause?: string;
}
