"""
NetSage AI - Deterministic Rule Checker
=========================================
Runs BEFORE the AI diagnosis engine. Scans raw Cisco IOS `show` command
output (and any config snippets included with a case) for mechanically
detectable fault signatures using plain string/regex matching -- no LLM
involved. This gives the AI engine pre-verified evidence to reason over,
and gives the whole pipeline an objective baseline to score AI accuracy
against.

Each rule returns a RuleFinding if it fires. A case can trigger zero,
one, or several findings.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List


@dataclass
class RuleFinding:
    rule_id: str
    concept_tag: str
    message: str
    evidence: str
    confidence: str = "high"  # deterministic rules are always high-confidence


@dataclass
class RuleCheckResult:
    case_id: str
    findings: List[RuleFinding] = field(default_factory=list)

    @property
    def triggered(self) -> bool:
        return len(self.findings) > 0

    def to_dict(self) -> dict:
        return {
            "case_id": self.case_id,
            "triggered": self.triggered,
            "findings": [f.__dict__ for f in self.findings],
        }


def _find(pattern: str, text: str, flags=re.IGNORECASE) -> re.Match | None:
    return re.search(pattern, text, flags)


# ---------------------------------------------------------------------------
# Individual rules. Each takes the combined evidence text for a case and
# returns a RuleFinding or None.
# ---------------------------------------------------------------------------

def rule_interface_admin_down(text: str) -> RuleFinding | None:
    m = _find(r"(\S+)\s+is administratively down", text)
    if m:
        return RuleFinding(
            rule_id="R-IFACE-DOWN",
            concept_tag="Interface-Down",
            message=f"Interface {m.group(1)} is administratively shut down.",
            evidence=m.group(0),
        )
    return None


def rule_err_disabled_port(text: str) -> RuleFinding | None:
    m = _find(r"(\S+)\s+err-disabled", text)
    if m:
        return RuleFinding(
            rule_id="R-ERR-DISABLED",
            concept_tag="Port-Security",
            message=f"Port {m.group(1)} is err-disabled, likely from a port security violation.",
            evidence=m.group(0),
        )
    return None


def rule_native_vlan_mismatch(text: str) -> RuleFinding | None:
    if _find(r"native\s+vlan\s+mismatch", text) or _find(r"NATIVE_VLAN_MISMATCH", text):
        return RuleFinding(
            rule_id="R-NATIVE-VLAN",
            concept_tag="Trunking",
            message="Native VLAN mismatch detected on a trunk link.",
            evidence="NATIVE_VLAN_MISMATCH signature found in evidence.",
        )
    natives = re.findall(r"native\s+vlan\s*[:\s]\s*(\d+)", text, re.IGNORECASE)
    if len(set(natives)) > 1:
        return RuleFinding(
            rule_id="R-NATIVE-VLAN",
            concept_tag="Trunking",
            message=f"Differing native VLAN IDs found across trunk ends: {sorted(set(natives))}.",
            evidence=", ".join(natives),
        )
    return None


def rule_dhcp_pool_exhausted(text: str) -> RuleFinding | None:
    m = _find(r"total addresses\s*:\s*(\d+).*?leased addresses\s*:\s*(\d+)", text, re.IGNORECASE | re.DOTALL)
    if m and int(m.group(1)) > 0 and int(m.group(1)) == int(m.group(2)):
        return RuleFinding(
            rule_id="R-DHCP-EXHAUSTED",
            concept_tag="DHCP",
            message=f"DHCP pool fully exhausted ({m.group(2)}/{m.group(1)} leases used).",
            evidence=m.group(0),
        )
    return None


def rule_missing_ip_helper(text: str) -> RuleFinding | None:
    if _find(r"interface vlan\s*\d+", text) and "ip helper-address" not in text.lower():
        if "dhcp" in text.lower() or "helper" in text.lower():
            return RuleFinding(
                rule_id="R-NO-IP-HELPER",
                concept_tag="DHCP-Relay",
                message="A routed VLAN interface is missing an 'ip helper-address' for DHCP relay.",
                evidence="No 'ip helper-address' found under the interface config in evidence.",
            )
    return None


def rule_ospf_area_mismatch(text: str) -> RuleFinding | None:
    areas = re.findall(r"area\s+(\d+)", text, re.IGNORECASE)
    if _find(r"INIT", text) and len(set(areas)) > 1:
        return RuleFinding(
            rule_id="R-OSPF-AREA",
            concept_tag="OSPF",
            message=f"OSPF neighbor stuck in INIT with differing area IDs in evidence: {sorted(set(areas))}.",
            evidence=", ".join(areas),
        )
    return None


def rule_ospf_timer_mismatch(text: str) -> RuleFinding | None:
    hellos = re.findall(r"hello[\s:]*[- ]?(\d+)", text, re.IGNORECASE)
    if len(set(hellos)) > 1:
        return RuleFinding(
            rule_id="R-OSPF-TIMER",
            concept_tag="OSPF",
            message=f"Mismatched OSPF hello timers found in evidence: {sorted(set(hellos))}.",
            evidence=", ".join(hellos),
        )
    return None


def rule_eigrp_as_mismatch(text: str) -> RuleFinding | None:
    as_nums = re.findall(r"router eigrp\s+(\d+)", text, re.IGNORECASE)
    if len(set(as_nums)) > 1:
        return RuleFinding(
            rule_id="R-EIGRP-AS",
            concept_tag="EIGRP",
            message=f"Mismatched EIGRP autonomous system numbers found: {sorted(set(as_nums))}.",
            evidence=", ".join(as_nums),
        )
    return None


def rule_acl_deny_all(text: str) -> RuleFinding | None:
    if _find(r"deny\s+ip\s+any\s+any", text) and not _find(r"permit\s+", text):
        return RuleFinding(
            rule_id="R-ACL-DENY-ALL",
            concept_tag="ACL",
            message="Access list contains a blanket 'deny ip any any' with no preceding permit statements.",
            evidence="deny ip any any (no permit lines found)",
        )
    return None


def rule_duplicate_ip(text: str) -> RuleFinding | None:
    ips = re.findall(r"Internet\s+(\d{1,3}(?:\.\d{1,3}){3})\s", text)
    dupes = {ip for ip in ips if ips.count(ip) > 1}
    if dupes:
        return RuleFinding(
            rule_id="R-DUP-IP",
            concept_tag="Duplicate-IP",
            message=f"Duplicate IP address(es) found in ARP table: {sorted(dupes)}.",
            evidence=", ".join(sorted(dupes)),
        )
    return None


def rule_missing_route(text: str) -> RuleFinding | None:
    m = _find(r"no route to ([\d./]+)", text)
    if m:
        return RuleFinding(
            rule_id="R-NO-ROUTE",
            concept_tag="Static-Routing",
            message=f"No route present in the routing table for destination {m.group(1)}.",
            evidence=m.group(0),
        )
    return None


def rule_duplex_mismatch(text: str) -> RuleFinding | None:
    if _find(r"half-duplex", text) and (_find(r"CRC", text) or _find(r"collisions", text)):
        return RuleFinding(
            rule_id="R-DUPLEX",
            concept_tag="Duplex-Mismatch",
            message="Half-duplex interface reporting CRC errors / collisions, indicative of a duplex mismatch.",
            evidence="half-duplex + CRC/collision counters found together.",
        )
    return None


def rule_wlan_disabled(text: str) -> RuleFinding | None:
    if _find(r"status\s*:\s*disabled", text) and _find(r"wlan", text, re.IGNORECASE):
        return RuleFinding(
            rule_id="R-WLAN-DISABLED",
            concept_tag="Wireless",
            message="WLAN profile is administratively disabled.",
            evidence="Status: Disabled found under WLAN config.",
        )
    return None


def rule_bgp_as_mismatch(text: str) -> RuleFinding | None:
    m = _find(r"AS\s+(\d+)\s+State:\s*Idle", text)
    if m:
        return RuleFinding(
            rule_id="R-BGP-IDLE",
            concept_tag="BGP",
            message=f"BGP neighbor stuck in Idle state with remote AS {m.group(1)} configured — verify against the ISP-assigned AS.",
            evidence=m.group(0),
        )
    return None


def rule_missing_ipv6_routing(text: str) -> RuleFinding | None:
    if _find(r"ipv6", text) and "ipv6 unicast-routing" not in text.lower() and _find(r"command not present", text):
        return RuleFinding(
            rule_id="R-NO-IPV6-ROUTING",
            concept_tag="IPv6",
            message="'ipv6 unicast-routing' not found in configuration; IPv6 forwarding is disabled globally.",
            evidence="ipv6 unicast-routing absent from show run output.",
        )
    return None


RULES = [
    rule_interface_admin_down,
    rule_err_disabled_port,
    rule_native_vlan_mismatch,
    rule_dhcp_pool_exhausted,
    rule_missing_ip_helper,
    rule_ospf_area_mismatch,
    rule_ospf_timer_mismatch,
    rule_eigrp_as_mismatch,
    rule_acl_deny_all,
    rule_duplicate_ip,
    rule_missing_route,
    rule_duplex_mismatch,
    rule_wlan_disabled,
    rule_bgp_as_mismatch,
    rule_missing_ipv6_routing,
]


def run_rule_checks(case_id: str, evidence_text: str) -> RuleCheckResult:
    """Run every rule against a case's combined evidence text."""
    findings: List[RuleFinding] = []
    for rule_fn in RULES:
        result = rule_fn(evidence_text)
        if result:
            findings.append(result)
    return RuleCheckResult(case_id=case_id, findings=findings)


if __name__ == "__main__":
    import csv
    import json
    import sys
    from pathlib import Path

    dataset_path = Path(__file__).resolve().parent.parent / "dataset" / "cases.csv"
    results = []
    with open(dataset_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            combined = f"{row['symptom']}\n{row['cli_snippet']}"
            res = run_rule_checks(row["case_id"], combined)
            results.append(res.to_dict())
            flag = "TRIGGERED" if res.triggered else "clean"
            print(f"{row['case_id']:8s} [{flag:9s}] {len(res.findings)} finding(s)")

    triggered = sum(1 for r in results if r["triggered"])
    print(f"\n{triggered}/{len(results)} cases triggered at least one deterministic rule.")

    if "--json" in sys.argv:
        out_path = Path(__file__).resolve().parent.parent / "dataset" / "rule_check_results.json"
        out_path.write_text(json.dumps(results, indent=2))
        print(f"Wrote {out_path}")
