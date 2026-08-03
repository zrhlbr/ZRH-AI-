/**
 * Layer 2 — AI Nebula（人工智能星云）
 * CSS + SVG 生成；总透明度约 18%；禁止照片/壁纸。
 */
export function AiNebula({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="zrh-cosmos-nebula absolute inset-0" />
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.18]"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="zrhNebulaA" cx="35%" cy="40%" r="45%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#1E3A8A" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="zrhNebulaB" cx="72%" cy="58%" r="40%">
            <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="zrhNebulaC" cx="50%" cy="22%" r="35%">
            <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.2" />
            <stop offset="60%" stopColor="#1E3A8A" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
          <filter id="zrhNebulaBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="28" />
          </filter>
        </defs>
        <g filter="url(#zrhNebulaBlur)">
          <ellipse cx="420" cy="320" rx="380" ry="260" fill="url(#zrhNebulaA)" />
          <ellipse cx="860" cy="460" rx="340" ry="240" fill="url(#zrhNebulaB)" />
          <ellipse cx="600" cy="180" rx="300" ry="200" fill="url(#zrhNebulaC)" />
        </g>
      </svg>
    </div>
  );
}
