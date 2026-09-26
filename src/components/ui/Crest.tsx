export function Crest({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 52"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M24 2 44 9v14c0 14-8 22-20 27C12 45 4 37 4 23V9z"
        fill="var(--ink-panel-raised, #2e1f15)"
        stroke="var(--gold, #c9a227)"
        strokeWidth="1.6"
      />
      <path
        d="M24 10v32M14 18h20M15 30h18"
        stroke="var(--gold, #c9a227)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="24" cy="18" r="2.4" fill="var(--gold-bright, #f0cf6e)" />
    </svg>
  );
}
