import { Link } from "react-router-dom";
import "./AppLogo.css";

interface AppLogoProps {
  size?: number | "sm" | "md" | "lg";
  withText?: boolean;
  to?: string;
  className?: string;
}

export function AppLogo({
  size = "md",
  withText = true,
  to = "/",
  className = "",
}: AppLogoProps) {
  const pixelSize =
    typeof size === "number"
      ? size
      : size === "sm"
        ? 28
        : size === "lg"
          ? 48
          : 36;

  const variantClass = typeof size === "string" ? size : "custom";

  const content = (
    <div className={`app-logo-mark app-logo-mark--${variantClass} ${className}`}>
      <div
        className="app-logo-badge"
        style={{ width: pixelSize, height: pixelSize }}
      >
        <img
          src="/logo.jpg"
          alt="RPG Platform Emblem"
          className="app-logo-image"
          loading="eager"
        />
      </div>
      {withText && (
        <span className="app-logo-text">
          <span className="app-logo-title">RPG Platform</span>
          <span className="app-logo-sub">Elementum</span>
        </span>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="app-logo-link" aria-label="Ir para a página inicial">
        {content}
      </Link>
    );
  }

  return content;
}
