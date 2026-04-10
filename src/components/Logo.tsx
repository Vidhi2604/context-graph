interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = 32, showText = true, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Orbital Nodes icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Orbit ring */}
        <circle cx="24" cy="24" r="14" stroke="#10b981" strokeWidth="1" opacity="0.25" strokeDasharray="3 3" />
        {/* Nodes on orbit */}
        <circle cx="24" cy="10" r="4"   fill="#10b981" />
        <circle cx="38" cy="24" r="3.5" fill="#10b981" opacity="0.75" />
        <circle cx="24" cy="38" r="3"   fill="#10b981" opacity="0.55" />
        <circle cx="10" cy="24" r="2.5" fill="#10b981" opacity="0.4" />
        {/* Center white dot */}
        <circle cx="24" cy="24" r="3" fill="white" />
        {/* Spokes */}
        <line x1="24" y1="14" x2="24" y2="21" stroke="#10b981" strokeWidth="1.5" opacity="0.6" />
        <line x1="35" y1="24" x2="27" y2="24" stroke="#10b981" strokeWidth="1.5" opacity="0.6" />
        <line x1="24" y1="35" x2="24" y2="27" stroke="#10b981" strokeWidth="1.5" opacity="0.45" />
      </svg>

      {showText && (
        <span className="font-semibold tracking-tight" style={{ fontSize: size * 0.56 }}>
          <span className="text-emerald-400">Context</span>
          <span className="text-white">Mesh</span>
        </span>
      )}
    </div>
  );
}
