import { useMemo, useState } from "react";
import casesData from "./data/cases.json";
import type { Case, ReviewRecord } from "./types";
import { runDiagnosis } from "./engine";
import Header from "./components/Header";
import CaseSelector from "./components/CaseSelector";
import CliViewer from "./components/CliViewer";
import RuleCheckPanel from "./components/RuleCheckPanel";
import AiDiagnosisPanel from "./components/AiDiagnosisPanel";
import HumanReviewPanel from "./components/HumanReviewPanel";
import MetricsDashboard from "./components/MetricsDashboard";
import RaiLogPanel from "./components/RaiLogPanel";

const cases = casesData as Case[];

type Tab = "workbench" | "metrics" | "rai-log";

export default function App() {
  const [tab, setTab] = useState<Tab>("workbench");
  const [activeId, setActiveId] = useState(cases[0]?.case_id ?? "");
  const [reviews, setReviews] = useState<Record<string, ReviewRecord>>({});

  const activeCase = cases.find((c) => c.case_id === activeId) ?? cases[0];
  const { findings, diagnosis } = useMemo(() => runDiagnosis(activeCase), [activeCase]);

  const ruleTriggeredCount = useMemo(
    () => cases.filter((c) => runDiagnosis(c).findings.length > 0).length,
    []
  );

  function saveReview(record: ReviewRecord) {
    setReviews((prev) => ({ ...prev, [record.case_id]: record }));
  }

  return (
    <div className="app-shell">
      <Header cases={cases} />

      <div className="tabs">
        <button className={`tab ${tab === "workbench" ? "active" : ""}`} onClick={() => setTab("workbench")}>
          01 // Diagnostic Workbench
        </button>
        <button className={`tab ${tab === "metrics" ? "active" : ""}`} onClick={() => setTab("metrics")}>
          02 // Benchmark Metrics
        </button>
        <button className={`tab ${tab === "rai-log" ? "active" : ""}`} onClick={() => setTab("rai-log")}>
          03 // Responsible AI Log
        </button>
      </div>

      {tab === "workbench" && (
        <div className="layout">
          <CaseSelector cases={cases} activeId={activeCase.case_id} onSelect={setActiveId} reviews={reviews} />
          <div>
            <CliViewer activeCase={activeCase} />
            <div className="split" style={{ marginTop: 16 }}>
              <RuleCheckPanel findings={findings} />
              <AiDiagnosisPanel diagnosis={diagnosis} />
            </div>
            <div style={{ marginTop: 16 }}>
              <HumanReviewPanel
                caseId={activeCase.case_id}
                existing={reviews[activeCase.case_id]}
                onSubmit={saveReview}
              />
            </div>
          </div>
        </div>
      )}

      {tab === "metrics" && (
        <MetricsDashboard cases={cases} reviews={reviews} ruleTriggeredCount={ruleTriggeredCount} />
      )}

      {tab === "rai-log" && <RaiLogPanel />}
    </div>
  );
}
