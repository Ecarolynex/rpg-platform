import type { ReactNode } from "react";
import "./OrnateFrame.css";

function Corner() {
  return (
    <svg viewBox="0 0 60 60" className="ornate-corner" aria-hidden="true">
      <path
        d="M2 58V16C2 8 8 2 16 2H58"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="16" cy="16" r="3.5" fill="currentColor" />
      <path
        d="M2 40C10 40 10 30 18 30"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M40 2C40 10 30 10 30 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function OrnateFrame({ children }: { children: ReactNode }) {
  return (
    <div className="ornate-frame">
      <Corner />
      <Corner />
      <Corner />
      <Corner />
      <div className="ornate-frame-content">{children}</div>
    </div>
  );
}
