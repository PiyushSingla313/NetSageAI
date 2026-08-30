import type { Case } from "../types";

interface Props {
  cases: Case[];
}

export default function Header({ cases }: Props) {
  return (
    <header className="header-wrap">
      <div className="header">
        <div>
          <div className="brand">
            <span className="brand-mark">
              Net<span className="accent-char">Sage</span> AI
              <span className="brand-cursor" aria-hidden="true" />
            </span>
          </div>
          <div className="brand-tagline">diagnostic workbench // human-in-the-loop</div>
        </div>
        <div className="header-meta">
          <span className="pill">{cases.length} cases loaded</span>
          <span className="pill">rule engine: local</span>
        </div>
      </div>
      <div className="scan-rule" aria-hidden="true" />
    </header>
  );
}
