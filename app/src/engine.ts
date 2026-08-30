// Browser-side port of checker/rule_checker.py and the offline fallback
// branch of src/ai_engine.py. This keeps the dashboard fully interactive
// without a backend. In a production deployment, wire runDiagnosis() to a
// real API route that calls Gemini server-side (never expose an LLM API
// key in frontend code).

import type { Case, Diagnosis, RuleFinding } from "./types";

type Rule = (text: string) => RuleFinding | null;

const rules: Rule[] = [
  (text) => {
    const m = text.match(/(\S+)\s+is administratively down/i);
    if (!m) return null;
    return {
      rule_id: "R-IFACE-DOWN",
      concept_tag: "Interface-Down",
      message: `Interface ${m[1]} is administratively shut down.`,
      evidence: m[0],
    };
  },
  (text) => {
    const m = text.match(/(\S+)\s+err-disabled/i);
    if (!m) return null;
    return {
      rule_id: "R-ERR-DISABLED",
      concept_tag: "Port-Security",
      message: `Port ${m[1]} is err-disabled, likely from a port security violation.`,
      evidence: m[0],
    };
  },
  (text) => {
    if (/native\s+vlan\s+mismatch/i.test(text) || /NATIVE_VLAN_MISMATCH/i.test(text)) {
      return {
        rule_id: "R-NATIVE-VLAN",
        concept_tag: "Trunking",
        message: "Native VLAN mismatch detected on a trunk link.",
        evidence: "NATIVE_VLAN_MISMATCH signature found in evidence.",
      };
    }
    const natives = [...text.matchAll(/native\s+vlan\s*[:\s]\s*(\d+)/gi)].map((m) => m[1]);
    const unique = [...new Set(natives)];
    if (unique.length > 1) {
      return {
        rule_id: "R-NATIVE-VLAN",
        concept_tag: "Trunking",
        message: `Differing native VLAN IDs found across trunk ends: ${unique.join(", ")}.`,
        evidence: natives.join(", "),
      };
    }
    return null;
  },
  (text) => {
    const m = text.match(/total addresses\s*:\s*(\d+)[\s\S]*?leased addresses\s*:\s*(\d+)/i);
    if (m && parseInt(m[1]) > 0 && m[1] === m[2]) {
      return {
        rule_id: "R-DHCP-EXHAUSTED",
        concept_tag: "DHCP",
        message: `DHCP pool fully exhausted (${m[2]}/${m[1]} leases used).`,
        evidence: m[0],
      };
    }
    return null;
  },
  (text) => {
    if (/interface vlan\s*\d+/i.test(text) && !/ip helper-address/i.test(text) && /dhcp|helper/i.test(text)) {
      return {
        rule_id: "R-NO-IP-HELPER",
        concept_tag: "DHCP-Relay",
        message: "A routed VLAN interface is missing an 'ip helper-address' for DHCP relay.",
        evidence: "No 'ip helper-address' found under the interface config in evidence.",
      };
    }
    return null;
  },
  (text) => {
    const areas = [...text.matchAll(/area\s+(\d+)/gi)].map((m) => m[1]);
    const unique = [...new Set(areas)];
    if (/INIT/i.test(text) && unique.length > 1) {
      return {
        rule_id: "R-OSPF-AREA",
        concept_tag: "OSPF",
        message: `OSPF neighbor stuck in INIT with differing area IDs in evidence: ${unique.join(", ")}.`,
        evidence: areas.join(", "),
      };
    }
    return null;
  },
  (text) => {
    const asNums = [...text.matchAll(/router eigrp\s+(\d+)/gi)].map((m) => m[1]);
    const unique = [...new Set(asNums)];
    if (unique.length > 1) {
      return {
        rule_id: "R-EIGRP-AS",
        concept_tag: "EIGRP",
        message: `Mismatched EIGRP autonomous system numbers found: ${unique.join(", ")}.`,
        evidence: asNums.join(", "),
      };
    }
    return null;
  },
  (text) => {
    if (/deny\s+ip\s+any\s+any/i.test(text) && !/permit\s+/i.test(text)) {
      return {
        rule_id: "R-ACL-DENY-ALL",
        concept_tag: "ACL",
        message: "Access list contains a blanket 'deny ip any any' with no preceding permit statements.",
        evidence: "deny ip any any (no permit lines found)",
      };
    }
    return null;
  },
  (text) => {
    const ips = [...text.matchAll(/Internet\s+(\d{1,3}(?:\.\d{1,3}){3})\s/g)].map((m) => m[1]);
    const dupes = [...new Set(ips.filter((ip) => ips.filter((x) => x === ip).length > 1))];
    if (dupes.length) {
      return {
        rule_id: "R-DUP-IP",
        concept_tag: "Duplicate-IP",
        message: `Duplicate IP address(es) found in ARP table: ${dupes.join(", ")}.`,
        evidence: dupes.join(", "),
      };
    }
    return null;
  },
  (text) => {
    const m = text.match(/no route to ([\d./]+)/i);
    if (!m) return null;
    return {
      rule_id: "R-NO-ROUTE",
      concept_tag: "Static-Routing",
      message: `No route present in the routing table for destination ${m[1]}.`,
      evidence: m[0],
    };
  },
  (text) => {
    if (/half-duplex/i.test(text) && (/CRC/i.test(text) || /collisions/i.test(text))) {
      return {
        rule_id: "R-DUPLEX",
        concept_tag: "Duplex-Mismatch",
        message: "Half-duplex interface reporting CRC errors / collisions, indicative of a duplex mismatch.",
        evidence: "half-duplex + CRC/collision counters found together.",
      };
    }
    return null;
  },
  (text) => {
    if (/status\s*:\s*disabled/i.test(text) && /wlan/i.test(text)) {
      return {
        rule_id: "R-WLAN-DISABLED",
        concept_tag: "Wireless",
        message: "WLAN profile is administratively disabled.",
        evidence: "Status: Disabled found under WLAN config.",
      };
    }
    return null;
  },
  (text) => {
    const m = text.match(/AS\s+(\d+)\s+State:\s*Idle/i);
    if (!m) return null;
    return {
      rule_id: "R-BGP-IDLE",
      concept_tag: "BGP",
      message: `BGP neighbor stuck in Idle state with remote AS ${m[1]} configured — verify against the ISP-assigned AS.`,
      evidence: m[0],
    };
  },
  (text) => {
    if (/ipv6/i.test(text) && !/ipv6 unicast-routing/i.test(text) && /command not present/i.test(text)) {
      return {
        rule_id: "R-NO-IPV6-ROUTING",
        concept_tag: "IPv6",
        message: "'ipv6 unicast-routing' not found in configuration; IPv6 forwarding is disabled globally.",
        evidence: "ipv6 unicast-routing absent from show run output.",
      };
    }
    return null;
  },
];

export function runRuleChecks(evidenceText: string): RuleFinding[] {
  return rules.map((r) => r(evidenceText)).filter((r): r is RuleFinding => r !== null);
}

const KEYWORD_ROOT_CAUSES: Array<[string, string]> = [
  ["administratively down", "The interface referenced in the evidence has been administratively shut down."],
  ["err-disabled", "A port security or other violation has placed the interface into an err-disabled state."],
  ["native vlan mismatch", "A native VLAN mismatch exists on the trunk link described in the evidence."],
  ["leased addresses", "The DHCP pool referenced in the evidence appears to be exhausted."],
  ["ip helper-address", "DHCP relay is likely missing on the routed interface described in the evidence."],
  ["area 1", "An OSPF area mismatch is likely blocking the neighbor adjacency described in the evidence."],
  ["deny ip any any", "An overly broad access-list entry is blocking legitimate traffic."],
  ["duplicate", "A duplicate IP address assignment is causing the conflict described in the evidence."],
  ["no route to", "The routing table is missing an entry for the destination described in the evidence."],
  ["half-duplex", "A duplex mismatch between the two ends of the link is likely causing the errors shown."],
  ["state: idle", "A BGP session parameter (likely the remote AS number) does not match what the peer expects."],
];

export function runDiagnosis(c: Case): { findings: RuleFinding[]; diagnosis: Diagnosis } {
  const evidenceText = `${c.symptom}\n${c.cli_snippet}`;
  const findings = runRuleChecks(evidenceText);

  let rootCause: string;
  let confidence: Diagnosis["confidence"];
  let evidence: string;

  if (findings.length > 0) {
    rootCause = findings[0].message;
    confidence = "medium";
    evidence = findings[0].evidence;
  } else {
    const lower = evidenceText.toLowerCase();
    const hit = KEYWORD_ROOT_CAUSES.find(([kw]) => lower.includes(kw));
    rootCause = hit ? hit[1] : "Unable to confirm a specific root cause from the available evidence without model access.";
    confidence = "low";
    evidence = c.cli_snippet.trim().split("\n")[0] || "(no evidence provided)";
  }

  const fixSteps = [c.fix_step_1, c.fix_step_2, c.fix_step_3].filter(Boolean);

  const diagnosis: Diagnosis = {
    root_cause: rootCause,
    confidence,
    evidence,
    next_command: `${c.next_command_device}# ${c.next_command_cmd}`,
    fix_steps: fixSteps.length
      ? fixSteps
      : ["Re-run with a live model connected for a fully reasoned fix.", "Manually verify the flagged evidence."],
    source: "offline_fallback",
  };

  return { findings, diagnosis };
}
