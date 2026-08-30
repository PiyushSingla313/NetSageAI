import type { Case } from "../types";

interface Props {
  activeCase: Case;
}

export default function CliViewer({ activeCase: c }: Props) {
  return (
    <div className="panel">
      <div className="case-header">
        <h2 className="case-title">{c.case_id}</h2>
        <div className="case-badges">
          <span className={`badge ${c.confidence_tier}`}>
            <span className="badge-dot" /> confidence tier: {c.confidence_tier}
          </span>
        </div>
      </div>

      <div className="symptom-callout">
        <p className="field-label">Symptom</p>
        <p className="symptom-text">{c.symptom}</p>
      </div>

      <div className="field-block">
        <p className="field-label">CLI evidence</p>
        <div className="cli-block">{c.cli_snippet}</div>
      </div>
    </div>
  );
}
