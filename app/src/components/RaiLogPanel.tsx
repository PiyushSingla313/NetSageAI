import { raiLog } from "../data/raiLog";

export default function RaiLogPanel() {
  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <p className="panel-title">Responsible AI Audit Log</p>
        <p style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6, margin: 0 }}>
          Every entry below documents a real case where this pipeline's AI output was incomplete,
          too vague, or needed a human correction before it could be trusted. The point isn't that
          the AI is always right — it's that the human review gate catches it when it isn't.
        </p>
      </div>

      {raiLog.map((entry) => (
        <div className="panel" key={entry.case_id}>
          <div className="case-header">
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>
                {entry.case_id} — {entry.title}
              </h3>
            </div>
            <span className={`badge ${entry.outcome === "corrected" ? "edited" : "accepted"}`}>
              {entry.outcome}
            </span>
          </div>

          <div className="field-block" style={{ marginTop: 12 }}>
            <p className="field-label">
              AI output <span className={`badge ${entry.ai_confidence}`} style={{ marginLeft: 6 }}>{entry.ai_confidence}</span>
            </p>
            <div className="cli-block" style={{ color: "var(--text)" }}>{entry.ai_output}</div>
          </div>

          <div className="field-block">
            <p className="field-label">What happened</p>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0, lineHeight: 1.55 }}>{entry.what_happened}</p>
          </div>

          <div className="field-block">
            <p className="field-label">Human correction</p>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0, lineHeight: 1.55 }}>{entry.human_correction}</p>
          </div>

          <div className="field-block">
            <p className="field-label">Lesson</p>
            <p style={{ fontSize: 13, color: "var(--accent)", margin: 0, lineHeight: 1.55 }}>{entry.lesson}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
