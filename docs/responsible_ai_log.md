# Responsible AI Audit Log

This log documents cases where the AI diagnosis engine's output was
incomplete, too vague, or needed a human correction before it could be
trusted. Every entry below is a real run of this repo's pipeline
(`python evaluate.py --export dataset/evaluation_results.json`) using
the **offline fallback engine** (no `GEMINI_API_KEY` configured at
write time). Once a real LLM key is added, re-run the evaluator and
update this log with genuine model outputs — the structure below
should stay the same either way.

The point of this document isn't to prove the AI is always right.
It's to prove the **human review gate catches it when it isn't**.

---

## Case NS-013 — NAT misconfiguration (low-confidence, correctly withheld)

**Symptom:** Internal hosts cannot reach the internet despite a valid
default route.

**AI output (offline engine):**
> "Unable to confirm a specific root cause from the available evidence
> without model access." — confidence: **low**

**What happened:** With no deterministic rule matching this case's
specific evidence pattern (a wrong subnet inside a NAT ACL), the
offline engine correctly declined to guess rather than fabricate a
plausible-sounding but ungrounded answer.

**Human correction:** Reviewer manually traced the NAT ACL and found
it permitted `192.168.2.0/24` instead of the actual LAN
`192.168.1.0/24` — a one-word typo in the subnet.

**Lesson:** A model that says "I don't know" with low confidence is
more useful than one that guesses with false confidence. This is the
behavior we want to preserve even after switching to a live LLM —
the prompt library's confidence-scoring rule (see
`prompts/diagnose_prompt.md`) exists specifically to make this
possible.

---

## Case NS-009 — OSPF area mismatch (right shape, needs precision)

**AI output:** "OSPF neighbor stuck in INIT with differing area IDs
in evidence: ['0', '1']." — confidence: **medium**

**What happened:** The rule checker correctly flagged the area
mismatch, but the AI's phrasing didn't specify *which router* was on
which area — a detail a human engineer needs before typing a fix.

**Human correction:** Reviewer added: "R2's Gi0/0 is in area 1; R1's
Gi0/0 is in area 0 — the fix belongs on R2."

**Lesson:** Detecting a discrepancy is not the same as producing an
actionable fix. Feeding this correction back into the few-shot
examples (Example 2 in the prompt library) should nudge future
outputs to always name which device needs the change.

---

## Case NS-023 — WLAN disabled (correct, but shallow)

**AI output:** "WLAN profile is administratively disabled." —
confidence: **medium**

**What happened:** Technically correct, but the response didn't
mention that `broadcast-ssid` was *also* disabled — meaning even
re-enabling the WLAN alone wouldn't fully fix the symptom.

**Human correction:** Reviewer added the missing `broadcast-ssid
enable` step to the fix.

**Lesson:** A diagnosis can be factually correct and still be an
incomplete fix. Human review isn't just a yes/no gate — it's where
partial answers get completed.

---

## Case NS-030 — Syslog blocked by ACL (too generic)

**AI output:** "An overly broad access-list entry is blocking
legitimate traffic." — confidence: **medium**

**What happened:** The rule checker matched a generic
`deny ip any any` pattern but didn't identify that the missing piece
was specifically a `permit udp ... eq 514` line for syslog traffic.

**Human correction:** Reviewer specified the exact missing ACL line
and the destination (syslog server, UDP 514).

**Lesson:** Generic pattern-matching rules are good at raising a flag
but not always at naming the precise fix. This is exactly the kind of
gap a real LLM call (vs. the offline fallback) is expected to close,
since it can reason about *why* UDP 514 specifically matters here.

---

## Case NS-004 — DHCP relay missing (correct, under-confident)

**AI output:** "DHCP relay is likely missing on the routed interface
described in the evidence." — confidence: **low**

**What happened:** The diagnosis was actually correct, but the
offline engine's confidence scoring is deliberately conservative and
defaulted to `low` even though the evidence was fairly clear
(`interface Vlan40` block with no `ip helper-address` line).

**Human correction:** Reviewer confirmed the diagnosis was fully
correct and upgraded it to **accepted**, no edits needed.

**Lesson:** Not every human review ends in a correction — this entry
is included to show the review log also counts confirmations, and
that "low confidence" from the offline engine doesn't always mean
"wrong." This is one input into confidence calibration once a live
LLM replaces the offline fallback for this rule.

---

## Summary

| Case | AI confidence | Review outcome | Category |
|------|---------------|-----------------|----------|
| NS-013 | low | Corrected (root cause found manually) | Under-confidence, correctly withheld |
| NS-009 | medium | Corrected (added device specificity) | Right shape, missing precision |
| NS-023 | medium | Corrected (added missing fix step) | Correct but incomplete |
| NS-030 | medium | Corrected (added specific missing rule) | Too generic |
| NS-004 | low | Accepted as-is | Under-confidence, correct answer |

**4 corrected / 1 accepted** out of these 5 highlighted cases. Re-run
`evaluate.py --export` after wiring up a live `GEMINI_API_KEY` and
replace this table with real model output — the offline fallback
engine exists for reliability, not as a benchmark of the AI's actual
diagnostic ceiling.
