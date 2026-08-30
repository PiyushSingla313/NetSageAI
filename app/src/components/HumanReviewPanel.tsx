import { useState } from "react";
import type { ReviewDecision, ReviewRecord } from "../types";

interface Props {
  caseId: string;
  existing?: ReviewRecord;
  onSubmit: (record: ReviewRecord) => void;
}

export default function HumanReviewPanel({ caseId, existing, onSubmit }: Props) {
  const [decision, setDecision] = useState<ReviewDecision>(existing?.decision ?? null);
  const [reviewer, setReviewer] = useState(existing?.reviewer ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [corrected, setCorrected] = useState(existing?.corrected_root_cause ?? "");
  const [justSaved, setJustSaved] = useState(false);

  function submit() {
    if (!decision) return;
    onSubmit({
      case_id: caseId,
      decision,
      reviewer: reviewer.trim() || "anonymous",
      notes: notes.trim(),
      corrected_root_cause: decision === "edited" ? corrected.trim() : undefined,
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2200);
  }

  return (
    <div className="panel">
      <p className="panel-title">Human Review — Safety Gate</p>

      <div className="review-actions">
        <button
          className={`review-btn ${decision === "accepted" ? "selected accept" : ""}`}
          onClick={() => setDecision("accepted")}
        >
          Accept
        </button>
        <button
          className={`review-btn ${decision === "edited" ? "selected edit" : ""}`}
          onClick={() => setDecision("edited")}
        >
          Edit
        </button>
        <button
          className={`review-btn ${decision === "rejected" ? "selected reject" : ""}`}
          onClick={() => setDecision("rejected")}
        >
          Reject
        </button>
      </div>

      {decision === "edited" && (
        <textarea
          className="review-textarea"
          placeholder="Corrected root cause…"
          value={corrected}
          onChange={(e) => setCorrected(e.target.value)}
        />
      )}

      <input
        className="review-input"
        placeholder="Reviewer name / initials"
        value={reviewer}
        onChange={(e) => setReviewer(e.target.value)}
      />
      <textarea
        className="review-textarea"
        placeholder="Notes (optional)…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {justSaved ? (
        <div className="review-confirmation">✓ Review saved</div>
      ) : (
        <button className="review-submit" onClick={submit} disabled={!decision}>
          Save review
        </button>
      )}

      {existing && !justSaved && (
        <p className="empty-note" style={{ marginTop: 10 }}>
          Last saved: <span className={`badge ${existing.decision}`}>{existing.decision}</span> by {existing.reviewer}
        </p>
      )}
    </div>
  );
}
