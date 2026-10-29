export function Crest({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-grid",
        placeItems: "center",
        border: "1.5px solid rgba(199, 166, 108, 0.45)",
        background: "#111310",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.4)",
        flexShrink: 0,
      }}
    >
      <img
        src="/logo.jpg"
        alt="RPG Platform Emblem"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        loading="eager"
      />
    </div>
  );
}
