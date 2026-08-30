import type { Case, ReviewRecord } from "../types";

interface Props {
  cases: Case[];
  activeId: string;
  onSelect: (id: string) => void;
  reviews: Record<string, ReviewRecord>;
}

export default function CaseSelector({ cases, activeId, onSelect, reviews }: Props) {
  return (
    <div className="panel">
      <p className="panel-title">Scenario Selector</p>
      <div className="case-list">
        {cases.map((c) => {
          const review = reviews[c.case_id];
          return (
            <button
              key={c.case_id}
              className={`case-item ${c.case_id === activeId ? "active" : ""}`}
              onClick={() => onSelect(c.case_id)}
            >
              <span className="case-item-id">
                {c.case_id}
                {review && (
                  <span className={`badge ${review.decision}`} style={{ marginLeft: 8, padding: "1px 6px", fontSize: 9 }}>
                    {review.decision}
                  </span>
                )}
              </span>
              <span className="case-item-symptom">{c.symptom}</span>
              <span className="case-item-tags">
                <span className="tag">{c.domain}</span>
                <span className="tag">L{c.osi_layer}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
