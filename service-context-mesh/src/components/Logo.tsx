interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export default function Logo({ size = 32, className = "", showText = true }: LogoProps) {
  const s = size;
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Diamond Mesh icon */}
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="8"  r="4" fill="#245AE2"/>
        <circle cx="8"  cy="24" r="4" fill="#245AE2" opacity="0.7"/>
        <circle cx="40" cy="24" r="4" fill="#245AE2" opacity="0.7"/>
        <circle cx="24" cy="40" r="4" fill="#245AE2" opacity="0.7"/>
        <circle cx="24" cy="24" r="6" fill="#ffffff"/>
        <circle cx="24" cy="24" r="11" fill="#245AE2" opacity="0.1"/>
        <line x1="24" y1="12" x2="24" y2="18" stroke="#245AE2" strokeWidth="1.5" opacity="0.7"/>
        <line x1="12" y1="24" x2="18" y2="24" stroke="#245AE2" strokeWidth="1.5" opacity="0.7"/>
        <line x1="30" y1="24" x2="36" y2="24" stroke="#245AE2" strokeWidth="1.5" opacity="0.7"/>
        <line x1="24" y1="30" x2="24" y2="36" stroke="#245AE2" strokeWidth="1.5" opacity="0.7"/>
      </svg>

      {showText && (
        <span className="font-bold tracking-tight" style={{ fontSize: s * 0.56, color: "var(--text-primary)" }}>
          Context<span style={{ color: "#245AE2" }}>Mesh</span>
        </span>
      )}
    </div>
  );
}
