import type { RuleFinding } from "../types";

interface Props {
  findings: RuleFinding[];
}

export default function RuleCheckPanel({ findings }: Props) {
  return (
    <div className="panel">
      <p className="panel-title">
        Rule Checker
        <span className={`badge ${findings.length ? "high" : "low"}`} style={{ marginLeft: "auto" }}>
          {findings.length ? "triggered" : "clean"}
        </span>
      </p>
      {findings.length === 0 && (
        <p className="empty-note">No deterministic rule matched this evidence. Diagnosis relies fully on the AI engine.</p>
      )}
      {findings.map((f) => (
        <div className="finding-row" key={f.rule_id}>
          <span className="finding-rule-id">{f.rule_id}</span>
          <span>{f.message}</span>
        </div>
      ))}
    </div>
  );
}
