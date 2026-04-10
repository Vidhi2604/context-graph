"use client";

export default function LogoConcepts() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-12">
      <h1 className="text-2xl font-bold mb-2 text-center">ContextMesh — Logo Concepts</h1>
      <p className="text-gray-500 text-center mb-12 text-sm">10 concepts — pick your favourite</p>

      <div className="max-w-5xl mx-auto space-y-14">

        {/* 1. Diamond Mesh */}
        <LogoRow num={1} name="Diamond Mesh" desc="5 nodes in a plus/diamond. Center glows — the unified profile. Clean and minimal.">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="8"  r="4" fill="#10b981"/>
            <circle cx="8"  cy="24" r="4" fill="#10b981" opacity="0.7"/>
            <circle cx="40" cy="24" r="4" fill="#10b981" opacity="0.7"/>
            <circle cx="24" cy="40" r="4" fill="#10b981" opacity="0.7"/>
            <circle cx="24" cy="24" r="6" fill="#10b981"/>
            <circle cx="24" cy="24" r="10" fill="#10b981" opacity="0.1"/>
            <line x1="24" y1="12" x2="24" y2="18" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            <line x1="12" y1="24" x2="18" y2="24" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            <line x1="30" y1="24" x2="36" y2="24" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            <line x1="24" y1="30" x2="24" y2="36" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
          </svg>
        </LogoRow>

        {/* 2. Hexagonal Network */}
        <LogoRow num={2} name="Hexagonal Network" desc="6 outer nodes in a hexagon. Feels enterprise and structured.">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="6"  r="3.5" fill="#10b981" opacity="0.8"/>
            <circle cx="38" cy="15" r="3.5" fill="#10b981" opacity="0.8"/>
            <circle cx="38" cy="33" r="3.5" fill="#10b981" opacity="0.8"/>
            <circle cx="24" cy="42" r="3.5" fill="#10b981" opacity="0.8"/>
            <circle cx="10" cy="33" r="3.5" fill="#10b981" opacity="0.8"/>
            <circle cx="10" cy="15" r="3.5" fill="#10b981" opacity="0.8"/>
            <circle cx="24" cy="24" r="5.5" fill="#10b981"/>
            <line x1="24" y1="9.5" x2="24" y2="18.5" stroke="#10b981" strokeWidth="1.2" opacity="0.5"/>
            <line x1="35" y1="17" x2="29" y2="21" stroke="#10b981" strokeWidth="1.2" opacity="0.5"/>
            <line x1="35" y1="31" x2="29" y2="27" stroke="#10b981" strokeWidth="1.2" opacity="0.5"/>
            <line x1="24" y1="38.5" x2="24" y2="29.5" stroke="#10b981" strokeWidth="1.2" opacity="0.5"/>
            <line x1="13" y1="31" x2="19" y2="27" stroke="#10b981" strokeWidth="1.2" opacity="0.5"/>
            <line x1="13" y1="17" x2="19" y2="21" stroke="#10b981" strokeWidth="1.2" opacity="0.5"/>
          </svg>
        </LogoRow>

        {/* 3. Orbital Nodes */}
        <LogoRow num={3} name="Orbital Nodes" desc="Nodes orbiting a white center dot. Data revolving around one source of truth.">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="14" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.2" strokeDasharray="3,3"/>
            <circle cx="24" cy="10" r="4"  fill="#10b981"/>
            <circle cx="38" cy="24" r="3.5" fill="#10b981" opacity="0.75"/>
            <circle cx="24" cy="38" r="3"  fill="#10b981" opacity="0.6"/>
            <circle cx="10" cy="24" r="2.5" fill="#10b981" opacity="0.45"/>
            <circle cx="24" cy="24" r="3"  fill="white"/>
            <line x1="24" y1="14" x2="24" y2="21" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            <line x1="35" y1="24" x2="27" y2="24" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            <line x1="24" y1="35" x2="24" y2="27" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
          </svg>
        </LogoRow>

        {/* 4. Grid Mesh */}
        <LogoRow num={4} name="Grid Mesh" desc="4 corners + center on a rounded square. App icon feel. Enterprise tagline.">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <rect width="48" height="48" rx="12" fill="#10b981" opacity="0.12"/>
            <circle cx="16" cy="16" r="4" fill="#10b981"/>
            <circle cx="32" cy="16" r="4" fill="#10b981" opacity="0.7"/>
            <circle cx="16" cy="32" r="4" fill="#10b981" opacity="0.7"/>
            <circle cx="32" cy="32" r="4" fill="#10b981" opacity="0.5"/>
            <circle cx="24" cy="24" r="5" fill="#10b981"/>
            <line x1="20" y1="16" x2="28" y2="16" stroke="#10b981" strokeWidth="1.5" opacity="0.5"/>
            <line x1="16" y1="20" x2="16" y2="28" stroke="#10b981" strokeWidth="1.5" opacity="0.5"/>
            <line x1="32" y1="20" x2="32" y2="28" stroke="#10b981" strokeWidth="1.5" opacity="0.5"/>
            <line x1="20" y1="32" x2="28" y2="32" stroke="#10b981" strokeWidth="1.5" opacity="0.5"/>
          </svg>
        </LogoRow>

        {/* 5. Pulse / Signal */}
        <LogoRow num={5} name="Pulse / Signal" desc="Concentric rings from a center. Intelligence radiating outward like a radar.">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#10b981" strokeWidth="0.8" opacity="0.15"/>
            <circle cx="24" cy="24" r="14" fill="none" stroke="#10b981" strokeWidth="0.8" opacity="0.25"/>
            <circle cx="24" cy="24" r="8"  fill="none" stroke="#10b981" strokeWidth="0.8" opacity="0.4"/>
            <circle cx="24" cy="24" r="4"  fill="#10b981"/>
            <circle cx="24" cy="4"  r="3"  fill="#10b981" opacity="0.9"/>
            <circle cx="44" cy="24" r="2.5" fill="#10b981" opacity="0.7"/>
            <circle cx="24" cy="44" r="2"  fill="#10b981" opacity="0.5"/>
            <line x1="24" y1="7" x2="24" y2="16" stroke="#10b981" strokeWidth="1.5" opacity="0.5"/>
            <line x1="41" y1="24" x2="32" y2="24" stroke="#10b981" strokeWidth="1.5" opacity="0.4"/>
          </svg>
        </LogoRow>

        <div className="border-t border-gray-800 pt-4">
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-8 text-center">5 new concepts below</p>
        </div>

        {/* 6. Neural Arc */}
        <LogoRow num={6} name="Neural Arc" desc="3 nodes connected in an arc with a glow trail. Suggests AI reasoning — left to right flow.">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <path d="M8 24 Q24 6 40 24" fill="none" stroke="#10b981" strokeWidth="1.2" opacity="0.3" strokeDasharray="2,2"/>
            <path d="M8 24 Q24 42 40 24" fill="none" stroke="#10b981" strokeWidth="1.2" opacity="0.2" strokeDasharray="2,2"/>
            <circle cx="8"  cy="24" r="4"   fill="#10b981" opacity="0.6"/>
            <circle cx="24" cy="24" r="7"   fill="#10b981"/>
            <circle cx="24" cy="24" r="12"  fill="#10b981" opacity="0.08"/>
            <circle cx="40" cy="24" r="4"   fill="#10b981" opacity="0.6"/>
            <circle cx="24" cy="12" r="3"   fill="#10b981" opacity="0.5"/>
            <line x1="12" y1="24" x2="17" y2="24" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            <line x1="31" y1="24" x2="36" y2="24" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            <line x1="24" y1="17" x2="24" y2="31" stroke="#10b981" strokeWidth="1" opacity="0.3"/>
          </svg>
        </LogoRow>

        {/* 7. Infinity Graph */}
        <LogoRow num={7} name="Infinity Graph" desc="Two overlapping circles forming a Venn/infinity shape with nodes at intersections. Identity resolution metaphor.">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="18" cy="24" r="12" fill="none" stroke="#10b981" strokeWidth="1.2" opacity="0.35"/>
            <circle cx="30" cy="24" r="12" fill="none" stroke="#10b981" strokeWidth="1.2" opacity="0.35"/>
            <ellipse cx="24" cy="24" rx="6" ry="10" fill="#10b981" opacity="0.12"/>
            <circle cx="8"  cy="24" r="3.5" fill="#10b981" opacity="0.7"/>
            <circle cx="40" cy="24" r="3.5" fill="#10b981" opacity="0.7"/>
            <circle cx="18" cy="14" r="2.5" fill="#10b981" opacity="0.5"/>
            <circle cx="30" cy="14" r="2.5" fill="#10b981" opacity="0.5"/>
            <circle cx="24" cy="24" r="5"   fill="#10b981"/>
          </svg>
        </LogoRow>

        {/* 8. Layered Nodes */}
        <LogoRow num={8} name="Layered Intelligence" desc="3 vertical layers of nodes — data layer, processing layer, insight layer. Shows the pipeline.">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="12" cy="10" r="3" fill="#10b981" opacity="0.4"/>
            <circle cx="24" cy="10" r="3" fill="#10b981" opacity="0.4"/>
            <circle cx="36" cy="10" r="3" fill="#10b981" opacity="0.4"/>
            <circle cx="16" cy="24" r="3.5" fill="#10b981" opacity="0.7"/>
            <circle cx="32" cy="24" r="3.5" fill="#10b981" opacity="0.7"/>
            <circle cx="24" cy="38" r="5"   fill="#10b981"/>
            <circle cx="24" cy="38" r="9"   fill="#10b981" opacity="0.1"/>
            <line x1="12" y1="13" x2="16" y2="20.5" stroke="#10b981" strokeWidth="1" opacity="0.4"/>
            <line x1="24" y1="13" x2="16" y2="20.5" stroke="#10b981" strokeWidth="1" opacity="0.4"/>
            <line x1="24" y1="13" x2="32" y2="20.5" stroke="#10b981" strokeWidth="1" opacity="0.4"/>
            <line x1="36" y1="13" x2="32" y2="20.5" stroke="#10b981" strokeWidth="1" opacity="0.4"/>
            <line x1="16" y1="27.5" x2="24" y2="33" stroke="#10b981" strokeWidth="1.2" opacity="0.6"/>
            <line x1="32" y1="27.5" x2="24" y2="33" stroke="#10b981" strokeWidth="1.2" opacity="0.6"/>
          </svg>
        </LogoRow>

        {/* 9. CM Lettermark */}
        <LogoRow num={9} name="CM Lettermark" desc="C and M letters formed by graph nodes and edges. Brand-first approach.">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <rect width="48" height="48" rx="10" fill="#10b981" opacity="0.1"/>
            {/* C */}
            <circle cx="8"  cy="12" r="2.5" fill="#10b981"/>
            <circle cx="16" cy="8"  r="2.5" fill="#10b981"/>
            <circle cx="8"  cy="24" r="2.5" fill="#10b981" opacity="0.8"/>
            <circle cx="16" cy="40" r="2.5" fill="#10b981"/>
            <circle cx="8"  cy="36" r="2.5" fill="#10b981"/>
            <line x1="8" y1="14.5" x2="8" y2="21.5" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            <line x1="8" y1="26.5" x2="8" y2="33.5" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            <line x1="10.5" y1="9.5" x2="14" y2="8.5" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            <line x1="10.5" y1="38.5" x2="14" y2="39.5" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            {/* M */}
            <circle cx="26" cy="8"  r="2.5" fill="#10b981"/>
            <circle cx="34" cy="24" r="2.5" fill="#10b981" opacity="0.8"/>
            <circle cx="42" cy="8"  r="2.5" fill="#10b981"/>
            <circle cx="26" cy="40" r="2.5" fill="#10b981"/>
            <circle cx="42" cy="40" r="2.5" fill="#10b981"/>
            <line x1="26" y1="10.5" x2="34" y2="21.5" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            <line x1="34" y1="21.5" x2="42" y2="10.5" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            <line x1="26" y1="10.5" x2="26" y2="37.5" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
            <line x1="42" y1="10.5" x2="42" y2="37.5" stroke="#10b981" strokeWidth="1.5" opacity="0.6"/>
          </svg>
        </LogoRow>

        {/* 10. Gradient Sphere */}
        <LogoRow num={10} name="Gradient Sphere" desc="A glowing sphere with orbiting nodes. Premium, modern — feels like a product icon on the App Store.">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <defs>
              <radialGradient id="glow" cx="40%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#34d399"/>
                <stop offset="100%" stopColor="#065f46"/>
              </radialGradient>
            </defs>
            <circle cx="24" cy="24" r="16" fill="url(#glow)"/>
            <circle cx="24" cy="24" r="16" fill="none" stroke="#10b981" strokeWidth="0.5" opacity="0.5"/>
            <ellipse cx="24" cy="24" rx="16" ry="6" fill="none" stroke="white" strokeWidth="0.6" opacity="0.2"/>
            <ellipse cx="24" cy="24" rx="6" ry="16" fill="none" stroke="white" strokeWidth="0.6" opacity="0.2"/>
            <circle cx="24" cy="8"  r="3" fill="white" opacity="0.9"/>
            <circle cx="40" cy="24" r="3" fill="white" opacity="0.7"/>
            <circle cx="8"  cy="24" r="2.5" fill="white" opacity="0.5"/>
            <line x1="24" y1="11" x2="24" y2="19" stroke="white" strokeWidth="1" opacity="0.6"/>
            <line x1="37" y1="24" x2="29" y2="24" stroke="white" strokeWidth="1" opacity="0.5"/>
          </svg>
        </LogoRow>

      </div>
    </div>
  );
}

function LogoRow({ num, name, desc, children }: { num: number; name: string; desc: string; children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-10">
        <div className="w-52 flex flex-col items-center gap-5 shrink-0">
          {/* Icon only */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-[10px] text-gray-700 uppercase tracking-widest mb-1">icon</div>
            {children}
          </div>
          {/* Full lockup */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-[10px] text-gray-700 uppercase tracking-widest mb-1">lockup</div>
            <div className="flex items-center gap-3">
              {children}
              <div>
                <div className="text-white font-bold text-base leading-none">Context</div>
                <div className="text-emerald-400 font-medium text-base leading-none">Mesh</div>
              </div>
            </div>
          </div>
          {/* Dark bg preview */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3 w-full">
            {children}
            <div>
              <div className="text-white font-bold text-sm leading-none">Context</div>
              <div className="text-emerald-400 text-sm leading-none">Mesh</div>
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded font-mono">#{num}</span>
            <h2 className="text-lg font-semibold">{name}</h2>
          </div>
          <p className="text-gray-400 text-sm max-w-md">{desc}</p>
        </div>
      </div>
      <div className="border-t border-gray-800"/>
    </>
  );
}
