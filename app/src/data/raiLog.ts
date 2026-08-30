export interface RaiEntry {
  case_id: string;
  title: string;
  ai_output: string;
  ai_confidence: "low" | "medium" | "high";
  what_happened: string;
  human_correction: string;
  lesson: string;
  outcome: "corrected" | "accepted";
}

export const raiLog: RaiEntry[] = [
  {
    case_id: "NS-013",
    title: "NAT misconfiguration — low-confidence, correctly withheld",
    ai_output: "Unable to confirm a specific root cause from the available evidence without model access.",
    ai_confidence: "low",
    what_happened:
      "With no deterministic rule matching this case's specific evidence pattern (a wrong subnet inside a NAT ACL), the offline engine correctly declined to guess rather than fabricate a plausible-sounding but ungrounded answer.",
    human_correction:
      "Reviewer manually traced the NAT ACL and found it permitted 192.168.2.0/24 instead of the actual LAN 192.168.1.0/24 — a one-word typo in the subnet.",
    lesson:
      "A model that says 'I don't know' with low confidence is more useful than one that guesses with false confidence.",
    outcome: "corrected",
  },
  {
    case_id: "NS-009",
    title: "OSPF area mismatch — right shape, needs precision",
    ai_output: "OSPF neighbor stuck in INIT with differing area IDs in evidence.",
    ai_confidence: "medium",
    what_happened:
      "The rule checker correctly flagged the area mismatch, but the AI's phrasing didn't specify which router was on which area — a detail an engineer needs before typing a fix.",
    human_correction: "Reviewer added: R2's Gi0/0 is in area 1; R1's Gi0/0 is in area 0 — the fix belongs on R2.",
    lesson:
      "Detecting a discrepancy is not the same as producing an actionable fix. Few-shot examples were updated to always name the device that needs the change.",
    outcome: "corrected",
  },
  {
    case_id: "NS-023",
    title: "WLAN disabled — correct, but shallow",
    ai_output: "WLAN profile is administratively disabled.",
    ai_confidence: "medium",
    what_happened:
      "Technically correct, but the response didn't mention that broadcast-ssid was also disabled — meaning re-enabling the WLAN alone wouldn't fully fix the symptom.",
    human_correction: "Reviewer added the missing 'broadcast-ssid enable' step to the fix.",
    lesson: "A diagnosis can be factually correct and still be an incomplete fix.",
    outcome: "corrected",
  },
  {
    case_id: "NS-030",
    title: "Syslog blocked by ACL — too generic",
    ai_output: "An overly broad access-list entry is blocking legitimate traffic.",
    ai_confidence: "medium",
    what_happened:
      "The rule checker matched a generic 'deny ip any any' pattern but didn't identify that the missing piece was specifically a permit line for UDP 514 (syslog).",
    human_correction: "Reviewer specified the exact missing ACL line and destination (syslog server, UDP 514).",
    lesson:
      "Generic pattern-matching rules are good at raising a flag but not always at naming the precise fix — this is where a live LLM call is expected to close the gap.",
    outcome: "corrected",
  },
  {
    case_id: "NS-004",
    title: "DHCP relay missing — correct, under-confident",
    ai_output: "DHCP relay is likely missing on the routed interface described in the evidence.",
    ai_confidence: "low",
    what_happened:
      "The diagnosis was actually correct, but the offline engine's confidence scoring is deliberately conservative and defaulted to low even though the evidence was fairly clear.",
    human_correction: "Reviewer confirmed the diagnosis was fully correct and accepted it — no edits needed.",
    lesson:
      "Not every human review ends in a correction. Low confidence from the offline engine doesn't always mean the answer was wrong.",
    outcome: "accepted",
  },
];
