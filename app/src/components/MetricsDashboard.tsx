import type { Case, ReviewRecord } from "../types";

interface Props {
  cases: Case[];
  reviews: Record<string, ReviewRecord>;
  ruleTriggeredCount: number;
}

export default function MetricsDashboard({ cases, reviews, ruleTriggeredCount }: Props) {
  const total = cases.length;
  const reviewList = Object.values(reviews);
  const accepted = reviewList.filter((r) => r.decision === "accepted").length;
  const edited = reviewList.filter((r) => r.decision === "edited").length;
  const rejected = reviewList.filter((r) => r.decision === "rejected").length;
  const reviewedCount = reviewList.length;
  const agreementRate = reviewedCount ? Math.round((accepted / reviewedCount) * 100) : null;

  const domainCounts = cases.reduce<Record<string, number>>((acc, c) => {
    acc[c.domain] = (acc[c.domain] ?? 0) + 1;
    return acc;
  }, {});
  const maxDomainCount = Math.max(...Object.values(domainCounts), 1);

  const layerCounts = cases.reduce<Record<string, number>>((acc, c) => {
    const key = `L${c.osi_layer} ${c.osi_layer_name}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-value">{total}</div>
          <div className="metric-label">Total scenarios</div>
        </div>
        <div className="metric-card">
          <div className="metric-value accent">
            {Math.round((ruleTriggeredCount / total) * 100)}%
          </div>
          <div className="metric-label">Rule engine trigger rate</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{reviewedCount}</div>
          <div className="metric-label">Cases reviewed</div>
        </div>
        <div className="metric-card">
          <div className={`metric-value ${agreementRate !== null && agreementRate >= 70 ? "good" : ""}`}>
            {agreementRate !== null ? `${agreementRate}%` : "—"}
          </div>
          <div className="metric-label">Human agreement rate</div>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <p className="panel-title">Review breakdown</p>
          <div className="bar-row">
            <span className="bar-label" style={{ color: "var(--success)" }}>Accepted</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(accepted / total) * 100}%`, background: "var(--success)" }} />
            </div>
            <span className="bar-count">{accepted}</span>
          </div>
          <div className="bar-row">
            <span className="bar-label" style={{ color: "var(--warning)" }}>Edited</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(edited / total) * 100}%`, background: "var(--warning)" }} />
            </div>
            <span className="bar-count">{edited}</span>
          </div>
          <div className="bar-row">
            <span className="bar-label" style={{ color: "var(--danger)" }}>Rejected</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(rejected / total) * 100}%`, background: "var(--danger)" }} />
            </div>
            <span className="bar-count">{rejected}</span>
          </div>
          <div className="bar-row">
            <span className="bar-label">Not yet reviewed</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${((total - reviewedCount) / total) * 100}%` }} />
            </div>
            <span className="bar-count">{total - reviewedCount}</span>
          </div>
        </div>

        <div className="panel">
          <p className="panel-title">OSI layer coverage</p>
          {Object.entries(layerCounts)
            .sort()
            .map(([layer, count]) => (
              <div className="bar-row" key={layer}>
                <span className="bar-label">{layer}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(count / total) * 100}%` }} />
                </div>
                <span className="bar-count">{count}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <p className="panel-title">Domain distribution</p>
        {Object.entries(domainCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([domain, count]) => (
            <div className="bar-row" key={domain}>
              <span className="bar-label">{domain}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(count / maxDomainCount) * 100}%` }} />
              </div>
              <span className="bar-count">{count}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
