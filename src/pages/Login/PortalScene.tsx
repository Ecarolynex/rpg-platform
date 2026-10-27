import { motion } from "motion/react";
import gateLeaf from "../../assets/portal/gate-leaf.jpg";
import gateScene from "../../assets/portal/gate-scene.jpg";
import realmLight from "../../assets/portal/realm-light.jpg";

interface PortalSceneProps {
  opened: boolean;
  reducedMotion: boolean;
}

const particles = Array.from({ length: 28 }, (_, index) => ({
  left: `${(index * 37 + 11) % 100}%`,
  top: `${(index * 53 + 7) % 100}%`,
  delay: `${(index % 9) * -0.7}s`,
  duration: `${5 + (index % 6)}s`,
  size: `${2 + (index % 3)}px`,
}));

const runes = ["ᚦ", "ᚨ", "ᚱ", "ᛉ", "ᛟ", "ᚷ", "ᛞ", "ᛗ"];

export function PortalScene({ opened, reducedMotion }: PortalSceneProps) {
  const transitionDuration = reducedMotion ? 0.1 : 3.15;

  return (
    <div className={`portal-scene${opened ? " portal-scene--opened" : ""}`} aria-hidden="true">
      <div className="portal-scene__stage">
        <div className="portal-scene__backdrop" style={{ backgroundImage: `url(${gateScene})` }} />

        <div className="portal-runes portal-runes--left">
          {runes.map((rune, index) => (
            <span
              key={`left-${rune}-${index}`}
              style={{ animationDelay: `${index * 180}ms`, transitionDelay: `${index * 180}ms` }}
            >
              {rune}
            </span>
          ))}
        </div>
        <div className="portal-runes portal-runes--right">
          {runes.slice().reverse().map((rune, index) => (
            <span
              key={`right-${rune}-${index}`}
              style={{ animationDelay: `${index * 180}ms`, transitionDelay: `${index * 180}ms` }}
            >
              {rune}
            </span>
          ))}
        </div>

        <div className="portal-archway">
          <div className="portal-aperture">
            <motion.div
              className="portal-aperture__realm"
              initial={false}
              animate={{
                opacity: opened ? [0.35, 1, 0.92] : 0,
                scale: opened ? [1.06, 1, 1] : 1.06,
              }}
              transition={{ duration: transitionDuration, times: [0, 0.72, 1], ease: "easeInOut" }}
              style={{ backgroundImage: `url(${realmLight})` }}
            />
            <motion.div
              className="portal-aperture__glow"
              initial={false}
              animate={{ opacity: opened ? [0.2, 0.9, 0.38] : 0 }}
              transition={{ duration: transitionDuration, times: [0, 0.72, 1], ease: "easeInOut" }}
            />
          </div>
          <div className={`portal-light-shaft${opened ? " portal-light-shaft--active" : ""}`} />

          <div className="portal-gate-leaves">
            <motion.div
              className="portal-gate-leaf portal-gate-leaf--left"
              style={{ backgroundImage: `url(${gateLeaf})` }}
              initial={false}
              animate={{ rotateY: opened ? 82 : 0, x: opened ? "-3%" : "0%" }}
              transition={{ duration: reducedMotion ? 0.1 : 3.05, ease: [0.58, 0.02, 0.22, 1] }}
            />
            <motion.div
              className="portal-gate-leaf portal-gate-leaf--right"
              style={{ backgroundImage: `url(${gateLeaf})` }}
              initial={false}
              animate={{ rotateY: opened ? -82 : 0, x: opened ? "3%" : "0%" }}
              transition={{
                duration: reducedMotion ? 0.1 : 3.25,
                delay: reducedMotion ? 0 : 0.08,
                ease: [0.58, 0.02, 0.22, 1],
              }}
            />
          </div>
        </div>

        <div className="portal-ground-glow" />
      </div>

      <div className="portal-scene__vignette" />
      <div className="portal-particles">
        {particles.map((particle, index) => (
          <i
            key={index}
            style={{
              left: particle.left,
              top: particle.top,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              width: particle.size,
              height: particle.size,
            }}
          />
        ))}
      </div>
    </div>
  );
}
