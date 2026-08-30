import type { Case } from "../types";

interface Props {
  activeCase: Case;
}

export default function CliViewer({ activeCase: c }: Props) {
  return (
    <div className="panel">
      <div className="case-header">
        <div>
          <h2 className="case-title">{c.case_id}</h2>
          <p className="case-subtitle">{c.symptom}</p>
        </div>
        <div className="case-badges">
          <span className={`badge ${c.confidence_tier}`}>
            <span className="badge-dot" /> ground truth: {c.confidence_tier}
          </span>
        </div>
      </div>

      <div className="field-block" style={{ marginTop: 16 }}>
        <p className="field-label">
          Domain — L{c.osi_layer} {c.osi_layer_name}
        </p>
        <p style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.55, margin: 0 }}>
          {c.domain} · logged {new Date(c.timestamp).toLocaleString()} · outcome: {c.outcome}
        </p>
      </div>

      <div className="field-block">
        <p className="field-label">CLI evidence</p>
        <div className="cli-block">{c.cli_snippet}</div>
      </div>
    </div>
  );
}
