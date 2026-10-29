import gateScene from "../../../assets/portal/gate-scene.jpg";

interface ParticleSpec {
  id: number;
  left: string;
  top: string;
  size: string;
  duration: string;
  delay: string;
  kind: "ember" | "dust";
}

const ENVIRONMENT_PARTICLES: ParticleSpec[] = Array.from({ length: 34 }, (_, index) => ({
  id: index,
  left: `${(index * 37 + 9) % 100}%`,
  top: `${(index * 53 + 13) % 100}%`,
  size: `${2 + (index % 4)}px`,
  duration: `${7 + (index % 8)}s`,
  delay: `${(index % 9) * -0.9}s`,
  kind: index % 2 === 0 ? "dust" : "ember",
}));

export function GrimoireEnvironment() {
  return (
    <div className="grimoire-env" aria-hidden="true">
      {/* Dark fantasy castle hall & distant dusk kingdom backdrop */}
      <div
        className="grimoire-env__backdrop"
        style={{ backgroundImage: `url(${gateScene})` }}
      />

      {/* Carved stone archway & candle-lit tavern/castle hall beams */}
      <svg
        className="grimoire-env__archways"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="stoneArchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0b0d10" stopOpacity="0.94" />
            <stop offset="50%" stopColor="#17181d" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#090a0d" stopOpacity="0.96" />
          </linearGradient>
          <linearGradient id="oakTableGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2b1810" stopOpacity="0.72" />
            <stop offset="40%" stopColor="#1e110b" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#0f0805" stopOpacity="0.97" />
          </linearGradient>
        </defs>

        {/* Stone hall arch */}
        <path
          d="M0,0 H1440 V900 H1320 V280 C1320,130 1130,36 720,36 C310,36 120,130 120,280 V900 H0 Z"
          fill="url(#stoneArchGrad)"
        />
        <path
          d="M120,900 V280 C120,130 310,36 720,36 C1130,36 1320,130 1320,280 V900"
          fill="none"
          stroke="rgba(212, 175, 55, 0.16)"
          strokeWidth="2"
        />

        {/* Aged wooden table surface at the bottom casting warm candlelight shadows */}
        <path
          d="M0,740 Q720,715 1440,740 L1440,900 L0,900 Z"
          fill="url(#oakTableGrad)"
        />
        <line
          x1="0"
          y1="742"
          x2="1440"
          y2="742"
          stroke="rgba(212, 175, 55, 0.18)"
          strokeWidth="1.5"
        />
        <line
          x1="0"
          y1="815"
          x2="1440"
          y2="815"
          stroke="rgba(12, 6, 3, 0.55)"
          strokeWidth="1.5"
        />
      </svg>

      {/* Flickering warm torchlight & tabletop candle glow */}
      <div className="grimoire-env__torch grimoire-env__torch--left" />
      <div className="grimoire-env__torch grimoire-env__torch--right" />
      <div className="grimoire-env__torch grimoire-env__torch--center" />
      <div className="grimoire-env__table-shadow" />

      {/* Semi-transparent contrast overlay for foreground readability */}
      <div className="grimoire-env__overlay" />

      {/* Floating dust motes and warm ember particles */}
      <div className="grimoire-env__particles">
        {ENVIRONMENT_PARTICLES.map((particle) => (
          <span
            key={particle.id}
            className={`grimoire-env__particle grimoire-env__particle--${particle.kind}`}
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              animationDuration: particle.duration,
              animationDelay: particle.delay,
            }}
          />
        ))}
      </div>
    </div>
  );
}
