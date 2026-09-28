import "./StatBar.css";

interface StatBarProps {
  label: string;
  atual: number;
  max: number;
  tone?: "wine" | "forest";
}

export function StatBar({ label, atual, max, tone = "wine" }: StatBarProps) {
  const pct = Math.max(0, Math.min(100, (atual / max) * 100));
  return (
    <div className="stat-bar">
      <div className="stat-bar-head">
        <span>{label}</span>
        <span>
          {atual} / {max}
        </span>
      </div>
      <div className="stat-bar-track">
        <div
          className={`stat-bar-fill stat-bar-fill--${tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
