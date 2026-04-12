"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import { useEffect, useRef, useState } from "react";

// ── Scroll trigger hook ───────────────────────────────────────────
function useScrollTrigger() {
  const ref = useState<HTMLDivElement | null>(null);
  const [triggered, setTriggered] = useState(false);
  const divRef = (el: HTMLDivElement | null) => { ref[1](el); };
  useEffect(() => {
    const el = ref[0];
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTriggered(true); obs.disconnect(); } }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref[0]]);
  return { divRef, triggered };
}

// ── Animated Graph Mockup ─────────────────────────────────────────
function GraphMockup() {
  const { divRef, triggered } = useScrollTrigger();
  const visible = triggered;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(3, Math.max(0.4, z - e.deltaY * 0.001)));
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPan(p => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseUp = () => { isDragging.current = false; };
  const recenter = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const cx = 380, cy = 280;
  const profiles = [
    { x: 380, y: 120, name: "Rohan Mehta",  color: "#a78bfa" },
    { x: 380, y: 440, name: "Priya Sharma", color: "#a78bfa" },
  ];
  const events = [
    { x: 160, y: 100, label: "support_ticket",  conf: "93%" },
    { x: 580, y: 100, label: "contact_upd...",  conf: "90%" },
    { x: 80,  y: 220, label: "support_ticket",  conf: "88%" },
    { x: 650, y: 200, label: "ticket_esc...",   conf: "89%" },
    { x: 120, y: 350, label: "contact_upd...",  conf: "85%" },
    { x: 610, y: 360, label: "satisfaction...", conf: "95%" },
    { x: 160, y: 460, label: "support_ticket",  conf: "88%" },
    { x: 580, y: 460, label: "contact_upd...",  conf: "91%" },
    { x: 260, y: 530, label: "support_ticket",  conf: "86%" },
    { x: 480, y: 530, label: "contact_upd...",  conf: "87%" },
  ];
  const edges = [
    [cx,cy,380,120],[cx,cy,380,440],
    [380,120,160,100],[380,120,580,100],[380,120,80,220],[380,120,650,200],
    [380,440,120,350],[380,440,610,360],[380,440,160,460],[380,440,580,460],[380,440,260,530],[380,440,480,530],
  ];

  return (
    <div ref={divRef} className="relative w-full rounded-2xl overflow-hidden"
      style={{ background:"#080c18", border:"1px solid #1e2e50", height:520, cursor: isDragging.current ? "grabbing" : "grab" }}
      onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="flex items-center gap-1.5 px-4 py-3" style={{ borderBottom:"1px solid #1e2e50", background:"#0d1426" }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background:"#f87171" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background:"#fbbf24" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background:"#4ade80" }} />
        <span className="ml-3 text-xs" style={{ color:"#4a6fa5" }}>Context Graph · Search: &quot;customer&quot;</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded" style={{ background:"rgba(36,90,226,0.15)", color:"#5b8fff" }}>12 nodes · 14 edges</span>
      </div>
      <svg width="100%" height="480" viewBox="-20 40 800 560"
        style={{ opacity:visible?1:0, transition:"opacity 0.8s ease" }}>
        <g transform={`translate(${pan.x + 380},${pan.y + 280}) scale(${zoom}) translate(-380,-280)`}>
          {edges.map(([x1,y1,x2,y2],i)=>(
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#245AE2" strokeWidth="1" strokeOpacity="0.35" strokeDasharray="4 3"
              style={{ animation:`fadeIn 0.4s ease ${i*0.07}s both` }} />
          ))}
          {edges.slice(0,4).map(([x1,y1,x2,y2],i)=>(
            <text key={i} x={(x1+x2)/2} y={(y1+y2)/2-5} fill="#2a4070" fontSize="8" textAnchor="middle"
              style={{ animation:`fadeIn 0.5s ease ${0.7+i*0.1}s both` }}>performed</text>
          ))}
          <circle cx={cx} cy={cy} r={50} fill="#0f1a50" stroke="#245AE2" strokeWidth="2"
            style={{ animation:"fadeIn 0.5s ease 0.1s both" }} />
          <circle cx={cx} cy={cy} r={46} fill="transparent" stroke="#3b6fd4" strokeWidth="1" strokeDasharray="3 2" />
          <text x={cx} y={cy-8} fill="#7ea8ff" fontSize="9" textAnchor="middle" fontWeight="600">SEARCH</text>
          <text x={cx} y={cy+8} fill="#eef2ff" fontSize="12" textAnchor="middle" fontWeight="700">customer</text>
          {profiles.map((p,i)=>(
            <g key={i} style={{ animation:`popIn 0.4s ease ${0.25+i*0.15}s both` }}>
              <circle cx={p.x} cy={p.y} r={30} fill="#160f40" stroke={p.color} strokeWidth="1.5" />
              <text x={p.x} y={p.y-6} fill={p.color} fontSize="7.5" textAnchor="middle" fontWeight="700">PROFILE</text>
              <text x={p.x} y={p.y+7} fill="#eef2ff" fontSize="9" textAnchor="middle">{p.name}</text>
            </g>
          ))}
          {events.map((e,i)=>(
            <g key={i} style={{ animation:`popIn 0.35s ease ${0.45+i*0.07}s both` }}>
              <rect x={e.x-40} y={e.y-22} width={80} height={44} rx={6}
                fill="#0d1426" stroke="#245AE2" strokeWidth="1" strokeOpacity="0.55" />
              <text x={e.x-31} y={e.y-8} fill="#5b8fff" fontSize="7" fontWeight="600">⚡ EVENT</text>
              <text x={e.x} y={e.y+4} fill="#c8d6f0" fontSize="7.5" textAnchor="middle">{e.label}</text>
              <text x={e.x} y={e.y+14} fill="#2a4070" fontSize="7" textAnchor="middle">{e.conf} confidence</text>
            </g>
          ))}
        </g>
      </svg>
      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1">
        <button onClick={() => setZoom(z => Math.min(3, z + 0.2))}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors"
          style={{ background:"#0d1426", border:"1px solid #1e2e50", color:"#a8badc" }}>+</button>
        <button onClick={() => setZoom(z => Math.max(0.4, z - 0.2))}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors"
          style={{ background:"#0d1426", border:"1px solid #1e2e50", color:"#a8badc" }}>−</button>
        <button onClick={recenter}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-colors"
          style={{ background:"#0d1426", border:"1px solid #1e2e50", color:"#a8badc" }} title="Recenter">⊙</button>
      </div>
      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes popIn{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}
      `}</style>
    </div>
  );
}

// ── Timeline Mockup ───────────────────────────────────────────────
function TimelineMockup() {
  const { divRef, triggered } = useScrollTrigger();
  const events = [
    { type:"Purchase",       amount:"₹4,599", date:"1 Apr 2026",  time:"10:00 am", color:"#4ade80" },
    { type:"Support Ticket", amount:"Open",   date:"3 Apr 2026",  time:"02:15 pm", color:"#a78bfa" },
    { type:"Product View",   amount:"₹2,999", date:"6 Apr 2026",  time:"02:30 pm", color:"#60a5fa" },
    { type:"Return",         amount:"₹4,599", date:"8 Apr 2026",  time:"11:00 am", color:"#f87171" },
    { type:"Wishlist Add",   amount:"₹6,999", date:"10 Apr 2026", time:"04:20 pm", color:"#fbbf24" },
    { type:"Purchase",       amount:"₹6,999", date:"12 Apr 2026", time:"09:45 am", color:"#4ade80" },
  ];
  return (
    <div ref={divRef} className="rounded-2xl overflow-hidden" style={{ background:"#080c18", border:"1px solid #1e2e50" }}>
      <div className="flex items-center gap-1.5 px-4 py-3" style={{ borderBottom:"1px solid #1e2e50", background:"#0d1426" }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background:"#f87171" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background:"#fbbf24" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background:"#4ade80" }} />
        <span className="ml-3 text-xs" style={{ color:"#4a6fa5" }}>Timeline · Priya Sharma · 6 events</span>
      </div>
      <div className="p-5">
        <div className="relative">
          <div className="absolute left-2.5 top-0 bottom-0 w-px" style={{ background:"#1e2e50" }} />
          <div className="space-y-2.5 pl-9">
            {events.map((e,i)=>(
              <div key={i} className="relative rounded-xl p-3.5"
                style={{ background:"#0d1426", border:"1px solid #1e2e50", ...(triggered ? { animation:`slideIn 0.35s ease ${i*0.09}s both` } : { opacity:0 }) }}>
                <div className="absolute top-4 w-2.5 h-2.5 rounded-full"
                  style={{ background:e.color, boxShadow:`0 0 6px ${e.color}`, left:"-2.35rem" }} />
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-semibold" style={{ color:e.color }}>{e.type}</div>
                    <div className="text-xs mt-0.5" style={{ color:"#4a6fa5" }}>{e.amount}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs" style={{ color:"#a8badc" }}>{e.date}</div>
                    <div className="text-xs" style={{ color:"#4a6fa5" }}>{e.time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}`}</style>
    </div>
  );
}

// ── Insight Mockup ────────────────────────────────────────────────
function InsightMockup() {
  const { divRef, triggered } = useScrollTrigger();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!triggered) return;
    const t = setInterval(() => setStep(s => s < 3 ? s+1 : 0), 1200);
    return () => clearInterval(t);
  }, [triggered]);

  return (
    <div ref={divRef} className="rounded-2xl overflow-hidden" style={{ background:"#080c18", border:"1px solid #1e2e50" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom:"1px solid #1e2e50", background:"#0d1426" }}>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background:"#f87171" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background:"#fbbf24" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background:"#4ade80" }} />
          <span className="ml-3 text-xs" style={{ color:"#4a6fa5" }}>AI Insight · Rohan Mehta</span>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background:"#0a1233", color:"#5b8fff", border:"1px solid #1e2e50" }}>Regenerate</span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3" style={{ height:300 }}>
        {[
          {
            title:"CONTEXT",
            body:(
              <div className="space-y-2 text-xs">
                <p style={{ color:"#a8badc", lineHeight:1.6 }}>Analyzing Rohan Mehta&apos;s engagement — product view followed by purchase on web channel.</p>
                {["Profile created: 2026-04-12","Location: Delhi","2 Events tracked","No exceptions flagged"].map((d,i)=>(
                  <div key={i} className="flex items-start gap-1.5" style={{ color:"#4a6fa5" }}>
                    <span style={{ color:"#245AE2", marginTop:1 }}>•</span>{d}
                  </div>
                ))}
              </div>
            )
          },
          {
            title:"REASONING",
            body:(
              <div className="space-y-2">
                {[
                  { conf:92, text:"Product view and purchase at identical timestamp with same transaction amount." },
                  { conf:88, text:"Both events show high confidence score and web channel attribution." },
                  { conf:79, text:"Profile created at first event — new customer via direct web." },
                ].map((r,i)=>(
                  <div key={i} className="text-xs rounded-lg p-2.5"
                    style={{ background:step>i?"#0a1640":"#0d1426", border:`1px solid ${step>i?"#245AE2":"#1e2e50"}`, transition:"all 0.4s ease" }}>
                    <div className="flex justify-between mb-1">
                      <span style={{ color:"#4a6fa5" }}>Step {i+1}</span>
                      <span style={{ color:step>i?"#5b8fff":"#2a4070" }}>{r.conf}%</span>
                    </div>
                    <p style={{ color:step>i?"#a8badc":"#2a4070", transition:"color 0.4s", lineHeight:1.5 }}>{r.text}</p>
                  </div>
                ))}
              </div>
            )
          },
          {
            title:"RESULT",
            body:(
              <div className="space-y-3">
                <p className="text-xs leading-relaxed" style={{ color:step>=3?"#eef2ff":"#2a4070", transition:"color 0.6s ease" }}>
                  Rohan completed a ₹2999 purchase immediately after profile creation with 0.85 data quality confidence.
                </p>
                <div className="rounded-lg p-2.5" style={{ background:"#0a1640", border:"1px solid #245AE2" }}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color:"#4a6fa5" }}>Confidence</span>
                    <span style={{ color:"#5b8fff" }}>82%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background:"#1e2e50" }}>
                    <div className="h-full rounded-full" style={{ width:step>=3?"82%":"0%", background:"#245AE2", transition:"width 1s ease" }} />
                  </div>
                </div>
                <p className="text-xs" style={{ color:"#5b8fff" }}>→ Flag for deduplication before reporting.</p>
              </div>
            )
          }
        ].map(({title,body})=>(
          <div key={title} className="rounded-xl p-3 flex flex-col overflow-hidden"
            style={{ background:"#0d1426", border:"1px solid #1e2e50" }}>
            <div className="text-xs font-bold mb-2.5 shrink-0 tracking-widest" style={{ color:"#5b8fff" }}>{title}</div>
            <div className="flex-1 overflow-y-auto">{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Activity Log Mockup ───────────────────────────────────────────
const LAYER_COLORS: Record<string, string> = {
  auth:"#6b7280", ingest:"#f97316", redis:"#f59e0b", process:"#3b82f6",
  llm:"#8b5cf6", neo4j:"#10b981", mapping:"#06b6d4", webhook:"#ec4899", crm:"#f97316",
};

const MOCK_PIPELINES = [
  {
    label: "Search: Aryan Kapoor",
    entries: [
      { layer:"auth",    label:"Auth & Tenant Resolution",   detail:'org: cmnw4j · plan: enterprise',          ms:"1ms",   done:true  },
      { layer:"llm",     label:"LLM Cypher Generation",      detail:'query: "Show journey for Aryan Kapoor"',  ms:"2997ms",done:true  },
      { layer:"crm",     label:"Live Search → HubSpot",      detail:'query: "Aryan Kapoor" · fetching...',     ms:"604ms", done:true  },
      { layer:"crm",     label:"Live Search → Zendesk",      detail:'query: "Aryan Kapoor" · 1 ticket found',  ms:"380ms", done:true  },
      { layer:"neo4j",   label:"Neo4j Query",                detail:'2 records returned',                       ms:"354ms", done:true  },
      { layer:"mapping", label:"Graph Mapping",              detail:'4 nodes · 3 edges',                        ms:"0ms",   done:true  },
    ]
  },
  {
    label: "Ingest: webhook.site",
    entries: [
      { layer:"auth",    label:"Auth & Tenant Resolution",   detail:'api_key: sk_... verified',                ms:"0ms",   done:true  },
      { layer:"ingest",  label:"Field Mapping",              detail:'12 events · client: hubspot',             ms:"8ms",   done:true  },
      { layer:"process", label:"Identity Resolution",        detail:'existing → prof_36246762',                ms:"6ms",   done:true  },
      { layer:"neo4j",   label:"Neo4j Write",                detail:'node: evt_a2698b04',                      ms:"11ms",  done:true  },
      { layer:"webhook", label:"Webhook Fire",               detail:'POST → webhook.site · confidence > 0.8',  ms:"203ms", done:true  },
      { layer:"mapping", label:"Graph Mapping",              detail:'3 nodes · 2 edges updated',               ms:"0ms",   done:true  },
    ]
  },
];

function ActivityLogMockup() {
  const { divRef, triggered } = useScrollTrigger();
  const [pipelineIdx, setPipelineIdx] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!triggered) return;
    setVisibleCount(0);
    const pipeline = MOCK_PIPELINES[pipelineIdx];
    let i = 0;
    const t = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= pipeline.entries.length) {
        clearInterval(t);
        setTimeout(() => {
          setPipelineIdx(p => (p + 1) % MOCK_PIPELINES.length);
          setVisibleCount(0);
        }, 2500);
      }
    }, 500);
    return () => clearInterval(t);
  }, [triggered, pipelineIdx]);

  const pipeline = MOCK_PIPELINES[pipelineIdx];

  return (
    <div ref={divRef} className="rounded-2xl overflow-hidden" style={{ background:"#080c18", border:"1px solid #1e2e50", fontFamily:"monospace" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom:"1px solid #1e2e50", background:"#0d1426" }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color:"#eef2ff", fontFamily:"sans-serif" }}>Activity Log</span>
          <span className="text-xs px-1.5 py-0.5 rounded animate-pulse" style={{ background:"rgba(74,222,128,0.15)", color:"#4ade80", border:"1px solid rgba(74,222,128,0.3)" }}>live</span>
        </div>
        <span className="text-xs" style={{ color:"#4a6fa5", fontFamily:"sans-serif" }}>{pipeline.label}</span>
      </div>
      {/* Legend */}
      <div className="px-4 py-2 flex flex-wrap gap-x-3 gap-y-1" style={{ borderBottom:"1px solid #1e2e50" }}>
        {[["auth","Auth"],["ingest","Ingest"],["llm","LLM"],["neo4j","Neo4j"],["mapping","Mapping"],["webhook","Webhook"],["crm","CRM"]].map(([k,l])=>(
          <span key={k} className="flex items-center gap-1 text-xs" style={{ color:"#4a6fa5", fontFamily:"sans-serif" }}>
            <span className="w-2 h-2 rounded-full" style={{ background:LAYER_COLORS[k] }} />{l}
          </span>
        ))}
      </div>
      {/* Entries */}
      <div className="p-3 space-y-1.5" style={{ minHeight:280 }}>
        {pipeline.entries.slice(0, visibleCount).map((e, i) => (
          <div key={i} className="rounded-lg px-3 py-2.5 flex items-start justify-between gap-2"
            style={{ background:"#0d1426", border:`1px solid #1e2e50`, animation:"fadeSlideIn 0.3s ease both" }}>
            <div className="flex items-start gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background:LAYER_COLORS[e.layer] }} />
              <div className="min-w-0">
                <div className="text-xs font-semibold" style={{ color:"#eef2ff", fontFamily:"sans-serif" }}>{e.label}</div>
                <div className="text-xs mt-0.5 truncate" style={{ color:"#4a6fa5" }}>{e.detail}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs" style={{ color:"#4a6fa5" }}>{e.ms}</span>
              <span style={{ color:"#4ade80", fontSize:10 }}>✓</span>
            </div>
          </div>
        ))}
        {visibleCount < pipeline.entries.length && visibleCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs" style={{ color:"#4a6fa5", fontFamily:"sans-serif" }}>processing...</span>
          </div>
        )}
      </div>
      <style>{`@keyframes fadeSlideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ── Animated Background ───────────────────────────────────────────
function AnimatedBackground() {
  const icons = [
    { size:40, top:"8%",  left:"6%",   dur:9,  delay:0   },
    { size:32, top:"15%", left:"88%",  dur:11, delay:1.5 },
    { size:48, top:"55%", left:"92%",  dur:13, delay:0.8 },
    { size:36, top:"75%", left:"4%",   dur:10, delay:2   },
    { size:44, top:"40%", left:"50%",  dur:14, delay:0.3 },
    { size:30, top:"85%", left:"70%",  dur:8,  delay:3   },
    { size:38, top:"25%", left:"75%",  dur:12, delay:1   },
    { size:46, top:"68%", left:"35%",  dur:10, delay:2.5 },
    { size:32, top:"92%", left:"20%",  dur:11, delay:1.2 },
    { size:42, top:"5%",  left:"45%",  dur:9,  delay:3.5 },
    { size:30, top:"48%", left:"18%",  dur:15, delay:0.6 },
    { size:44, top:"32%", left:"62%",  dur:12, delay:4   },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex:0 }}>
      {icons.map((ic, i) => (
        <div key={i} style={{
          position:"absolute", top:ic.top, left:ic.left,
          opacity:0.18,
          animation:`float${i%4} ${ic.dur}s ease-in-out ${ic.delay}s infinite`,
        }}>
          <svg width={ic.size} height={ic.size} viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="8"  r="4" fill="#ffffff"/>
            <circle cx="8"  cy="24" r="4" fill="#ffffff" opacity="0.7"/>
            <circle cx="40" cy="24" r="4" fill="#ffffff" opacity="0.7"/>
            <circle cx="24" cy="40" r="4" fill="#ffffff" opacity="0.7"/>
            <circle cx="24" cy="24" r="6" fill="#ffffff"/>
            <circle cx="24" cy="24" r="11" fill="#ffffff" opacity="0.1"/>
            <line x1="24" y1="12" x2="24" y2="18" stroke="#ffffff" strokeWidth="1.5" opacity="0.6"/>
            <line x1="12" y1="24" x2="18" y2="24" stroke="#ffffff" strokeWidth="1.5" opacity="0.6"/>
            <line x1="30" y1="24" x2="36" y2="24" stroke="#ffffff" strokeWidth="1.5" opacity="0.6"/>
            <line x1="24" y1="30" x2="24" y2="36" stroke="#ffffff" strokeWidth="1.5" opacity="0.6"/>
          </svg>
        </div>
      ))}
      <style>{`
        @keyframes float0 { 0%{transform:translate(0,0) rotate(0deg)} 25%{transform:translate(22px,-18px) rotate(8deg)} 50%{transform:translate(-14px,-30px) rotate(-5deg)} 75%{transform:translate(-24px,-12px) rotate(10deg)} 100%{transform:translate(0,0) rotate(0deg)} }
        @keyframes float1 { 0%{transform:translate(0,0) rotate(0deg)} 25%{transform:translate(-18px,20px) rotate(-8deg)} 50%{transform:translate(20px,14px) rotate(6deg)} 75%{transform:translate(10px,-18px) rotate(-4deg)} 100%{transform:translate(0,0) rotate(0deg)} }
        @keyframes float2 { 0%{transform:translate(0,0) rotate(0deg)} 25%{transform:translate(16px,22px) rotate(12deg)} 50%{transform:translate(-20px,10px) rotate(-8deg)} 75%{transform:translate(-10px,-20px) rotate(6deg)} 100%{transform:translate(0,0) rotate(0deg)} }
        @keyframes float3 { 0%{transform:translate(0,0) rotate(0deg)} 25%{transform:translate(-24px,-16px) rotate(-10deg)} 50%{transform:translate(18px,-24px) rotate(8deg)} 75%{transform:translate(22px,16px) rotate(-6deg)} 100%{transform:translate(0,0) rotate(0deg)} }
      `}</style>
    </div>
  );
}

// ── Landing Page ──────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-screen relative" style={{ background:"var(--bg-base)", color:"var(--text-primary)" }}>
      <AnimatedBackground />

      {/* Nav */}
      <nav className="relative flex items-center justify-between px-4 lg:px-10 py-4 lg:py-5 sticky top-0 z-50"
        style={{ borderBottom:"1px solid var(--border)", background:"var(--bg-surface)" }}>
        <Logo size={40} />
        <div className="flex items-center gap-8 text-sm" style={{ color:"var(--text-secondary)" }}>
          <Link href="/api-docs" className="hover:opacity-80 transition-opacity">API Docs</Link>
          <Link href="/auth/signin" className="hover:opacity-80 transition-opacity">Sign In</Link>
          <Link href="/auth/signup" className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors">
            Get Started →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center px-6 pt-14 pb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background:"rgba(36,90,226,0.12)", border:"1px solid rgba(36,90,226,0.3)", color:"#5b8fff" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Live CRM Sync · AI Insights · Real-time Webhooks
        </div>
        <h1 className="mx-auto mb-5" style={{ fontSize:"clamp(2rem,4vw,3.2rem)", fontWeight:800, lineHeight:1.1, letterSpacing:"-0.025em", maxWidth:780 }}>
          Your CRM, support tool, and voice platform<br />
          <span style={{ color:"#245AE2" }}>don&apos;t talk to each other. We fix that.</span>
        </h1>
        <p className="mx-auto mb-3 text-lg leading-relaxed" style={{ color:"var(--text-secondary)", maxWidth:560 }}>
          ContextMesh connects every customer event — purchases, tickets, calls, returns — into one searchable graph. Ask anything. Get the full picture instantly.
        </p>
        <p className="mx-auto mb-8 text-sm" style={{ color:"var(--text-muted)", maxWidth:460 }}>
          No data wrangling. No switching tools. No blind spots.
        </p>
        <div className="flex items-center justify-center gap-4 mb-10">
          <Link href="/auth/signup" className="bg-emerald-600 hover:bg-emerald-500 text-white px-7 py-3 rounded-xl font-semibold text-base transition-colors">
            Try it Free →
          </Link>
          <Link href="/auth/signin" className="px-7 py-3 rounded-xl font-medium text-base transition-colors"
            style={{ border:"1px solid var(--border-strong)", color:"var(--text-secondary)" }}>
            Sign In
          </Link>
        </div>
        {/* Problem → solution row */}
        <div className="flex items-center justify-center gap-3 flex-wrap max-w-3xl mx-auto">
          {[
            "CRM contact ≠ support history",
            "Voice call ≠ purchase context",
            "Ticket ≠ customer journey",
          ].map((pain, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium line-through"
                style={{ background:"var(--bg-surface-2)", border:"1px solid var(--border)", color:"var(--text-muted)" }}>
                {pain}
              </span>
              {i < 2 && <span style={{ color:"var(--text-muted)" }}>+</span>}
            </div>
          ))}
          <span style={{ color:"var(--text-muted)", fontSize:"1.2rem", fontWeight:700 }}>→</span>
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background:"rgba(36,90,226,0.12)", border:"1px solid rgba(36,90,226,0.35)", color:"#5b8fff" }}>
            One unified context graph
          </span>
        </div>
      </section>

      {/* ── Zig-zag sections ── */}

      {/* Row 1: Graph right, text left */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center"
        style={{ borderTop:"1px solid var(--border)" }}>
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold tracking-widest uppercase"
            style={{ background:"rgba(36,90,226,0.12)", border:"1px solid rgba(36,90,226,0.35)", color:"#5b8fff" }}>
            🕸 Context Graph
          </div>
          <p className="text-base font-semibold" style={{ color:"var(--text-muted)" }}>
            You have the data. It&apos;s just scattered across 5 different tools.
          </p>
          <h2 style={{ fontSize:"2.4rem", fontWeight:900, lineHeight:1.1, letterSpacing:"-0.025em" }}>
            Search once.<br />See everything.
          </h2>
          <p className="text-lg leading-relaxed" style={{ color:"var(--text-secondary)", maxWidth:420 }}>
            Type a customer name. Get their purchases, support tickets, voice calls, and returns — all linked, all visible, in seconds. No joins. No exports. No waiting.
          </p>
          <ul className="space-y-3">
            {[
              "Profiles auto-linked across email, phone, and CRM ID",
              "Ask in plain English — no query language needed",
              "Connects HubSpot, Zendesk, Nurix and any API",
              "Live search — new contacts appear as you type",
            ].map(f=>(
              <li key={f} className="flex items-center gap-2.5 text-base" style={{ color:"var(--text-secondary)" }}>
                <span className="shrink-0 font-bold" style={{ color:"#245AE2" }}>→</span> {f}
              </li>
            ))}
          </ul>
        </div>
        <GraphMockup />
      </section>

      {/* Row 2: text right, Timeline left */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center"
        style={{ borderTop:"1px solid var(--border)" }}>
        <TimelineMockup />
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold tracking-widest uppercase"
            style={{ background:"rgba(36,90,226,0.12)", border:"1px solid rgba(36,90,226,0.35)", color:"#5b8fff" }}>
            📅 Event Timeline
          </div>
          <p className="text-base font-semibold" style={{ color:"var(--text-muted)" }}>
            Your support team sees tickets. Sales sees deals. Nobody sees the customer.
          </p>
          <h2 style={{ fontSize:"2.4rem", fontWeight:900, lineHeight:1.1, letterSpacing:"-0.025em" }}>
            Every event.<br />One timeline.
          </h2>
          <p className="text-lg leading-relaxed" style={{ color:"var(--text-secondary)", maxWidth:420 }}>
            From first purchase to latest support call — every interaction, every channel, laid out in order. Your team finally sees what the customer actually went through.
          </p>
          <ul className="space-y-3">
            {[
              "Syncs live — no manual imports or scheduled jobs",
              "Color-coded by event type for instant scanning",
              "Click any event to drill into full context",
              "Supports retail, CX, healthcare out of the box",
            ].map(f=>(
              <li key={f} className="flex items-center gap-2.5 text-base" style={{ color:"var(--text-secondary)" }}>
                <span className="shrink-0 font-bold" style={{ color:"#245AE2" }}>→</span> {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Row 3: Insight right, text left */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center"
        style={{ borderTop:"1px solid var(--border)" }}>
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold tracking-widest uppercase"
            style={{ background:"rgba(36,90,226,0.12)", border:"1px solid rgba(36,90,226,0.35)", color:"#5b8fff" }}>
            🧠 AI Insights
          </div>
          <p className="text-base font-semibold" style={{ color:"var(--text-muted)" }}>
            You know something is wrong. You just can&apos;t prove it fast enough.
          </p>
          <h2 style={{ fontSize:"2.4rem", fontWeight:900, lineHeight:1.1, letterSpacing:"-0.025em" }}>
            From pattern<br />to action — instantly.
          </h2>
          <p className="text-lg leading-relaxed" style={{ color:"var(--text-secondary)", maxWidth:420 }}>
            Hit Analyze on any search result. Get a step-by-step reasoning chain, a confidence score, and a clear recommendation — then auto-push it to your CRM the moment it matters.
          </p>
          <ul className="space-y-3">
            {[
              "Multi-step reasoning — not just a summary",
              "Set conditions like 'confidence > 0.8' to auto-fire alerts",
              "Pushes findings to HubSpot, Zendesk, or any webhook",
              "Identifies churn risk, policy drift, commitment breaches",
            ].map(f=>(
              <li key={f} className="flex items-center gap-2.5 text-base" style={{ color:"var(--text-secondary)" }}>
                <span className="shrink-0 font-bold" style={{ color:"#245AE2" }}>→</span> {f}
              </li>
            ))}
          </ul>
        </div>
        <InsightMockup />
      </section>

      {/* Row 4: Activity Log left, text right */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center"
        style={{ borderTop:"1px solid var(--border)" }}>
        <ActivityLogMockup />
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold tracking-widest uppercase"
            style={{ background:"rgba(36,90,226,0.12)", border:"1px solid rgba(36,90,226,0.35)", color:"#5b8fff" }}>
            ⚡ Activity Log
          </div>
          <p className="text-base font-semibold" style={{ color:"var(--text-muted)" }}>
            You connect a CRM. Something fires. But did it actually work?
          </p>
          <h2 style={{ fontSize:"2.4rem", fontWeight:900, lineHeight:1.1, letterSpacing:"-0.025em" }}>
            See every step.<br />In real time.
          </h2>
          <p className="text-lg leading-relaxed" style={{ color:"var(--text-secondary)", maxWidth:420 }}>
            Every search, every ingest, every CRM call, every webhook fire — traced live. Your clients know exactly what happened, when, and how fast.
          </p>
          <ul className="space-y-3">
            {[
              "CRM API calls traced with response times",
              "Webhook fires logged with condition matched",
              "Identity resolution shown step by step",
              "LLM queries, Neo4j writes — all visible",
            ].map(f => (
              <li key={f} className="flex items-center gap-2.5 text-base" style={{ color:"var(--text-secondary)" }}>
                <span className="shrink-0 font-bold" style={{ color:"#245AE2" }}>→</span> {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-16 text-center" style={{ borderTop:"1px solid var(--border)" }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-10" style={{ color:"#4a6fa5" }}>Connects with your existing stack</p>
        <div className="flex items-center justify-center gap-4 flex-wrap px-10">
          {[
            {
              name:"HubSpot",
              icon:(
                <svg width="20" height="20" viewBox="333 0 179 149" xmlns="http://www.w3.org/2000/svg">
                  <path d="M461.278 69.831c-3.256-5.602-7.836-10.093-13.562-13.474-4.279-2.491-8.716-4.072-13.716-4.751v-17.8c5-2.123 8.103-6.822 8.103-12.304 0-7.472-5.992-13.527-13.458-13.527-7.472 0-13.569 6.055-13.569 13.527 0 5.482 2.924 10.181 7.924 12.304v17.808c-4 .578-8.148 1.825-11.936 3.741-7.737-5.876-33.107-25.153-47.948-36.412.352-1.269.623-2.577.623-3.957 0-8.276-6.702-14.984-14.981-14.984S333.78 6.71 333.78 14.986c0 8.275 6.706 14.985 14.985 14.985 2.824 0 5.436-.826 7.69-2.184l3.132 2.376 43.036 31.008c-2.275 2.089-4.394 4.465-6.089 7.131C393.099 73.737 391 79.717 391 86.24v1.361c0 4.579.87 8.902 2.352 12.963 1.305 3.546 3.213 6.77 5.576 9.685l-14.283 14.318a11.501 11.501 0 0 0-12.166 2.668 11.499 11.499 0 0 0-3.388 8.19c.001 3.093 1.206 6 3.394 8.187a11.5 11.5 0 0 0 8.188 3.394 11.51 11.51 0 0 0 8.191-3.394 11.514 11.514 0 0 0 3.39-8.187c0-1.197-.185-2.365-.533-3.475l14.763-14.765c2.024 1.398 4.21 2.575 6.56 3.59 4.635 2.004 9.751 3.225 15.35 3.225h1.026c6.19 0 12.029-1.454 17.518-4.428 5.784-3.143 10.311-7.441 13.731-12.928 3.438-5.502 5.331-11.581 5.331-18.269v-.334c0-6.579-1.523-12.649-4.722-18.21zm-18.038 30.973c-4.007 4.453-8.613 7.196-13.82 7.196h-.858c-2.974 0-5.883-.822-8.731-2.317-3.21-1.646-5.65-3.994-7.647-6.967-2.064-2.918-3.184-6.104-3.184-9.482v-1.026c0-3.321.637-6.47 2.243-9.444 1.717-3.251 4.036-5.779 7.12-7.789 3.028-1.996 6.262-2.975 9.864-2.975h.335c3.266 0 6.358.644 9.276 2.137 2.973 1.592 5.402 3.767 7.285 6.628 1.829 2.862 2.917 5.949 3.267 9.312.055.699.083 1.415.083 2.099 0 4.564-1.744 8.791-5.233 12.628z" fill="#F8761F"/>
                </svg>
              )
            },
            {
              name:"Zendesk",
              icon:<img src="/logos/zendesk.svg" alt="Zendesk" className="w-5 h-5 object-contain" />
            },
            {
              name:"Salesforce",
              icon:<img src="/logos/salesforce.svg" alt="Salesforce" className="w-5 h-5 object-contain" />
            },
            {
              name:"Zoho",
              icon:(
                <svg width="28" height="20" viewBox="0 0 56 36">
                  <rect x="0"  y="6"  width="20" height="20" rx="5" fill="none" stroke="#E42527" strokeWidth="4"/>
                  <rect x="12" y="1"  width="20" height="20" rx="5" fill="none" stroke="#2E9E44" strokeWidth="4"/>
                  <rect x="24" y="6"  width="20" height="20" rx="5" fill="none" stroke="#1A73E8" strokeWidth="4"/>
                  <rect x="36" y="11" width="20" height="20" rx="5" fill="none" stroke="#F4A800" strokeWidth="4"/>
                </svg>
              )
            },
            {
              name:"REST API",
              icon:(
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="3" fill="#a8badc"/>
                  <path d="M10 2a1 1 0 0 1 1 1v1.07a6 6 0 0 1 2.6 1.07l.76-.76a1 1 0 1 1 1.41 1.41l-.76.76A6 6 0 0 1 16.93 9H18a1 1 0 0 1 0 2h-1.07a6 6 0 0 1-1.07 2.6l.76.76a1 1 0 1 1-1.41 1.41l-.76-.76A6 6 0 0 1 11 16.93V18a1 1 0 0 1-2 0v-1.07a6 6 0 0 1-2.6-1.07l-.76.76a1 1 0 1 1-1.41-1.41l.76-.76A6 6 0 0 1 3.07 11H2a1 1 0 0 1 0-2h1.07a6 6 0 0 1 1.07-2.6l-.76-.76a1 1 0 1 1 1.41-1.41l.76.76A6 6 0 0 1 9 3.07V2a1 1 0 0 1 1-1z" fill="#a8badc"/>
                </svg>
              )
            },
            {
              name:"Webhooks",
              icon:(
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect width="20" height="20" rx="4" fill="#1e1a3a"/>
                  <path d="M6 14 Q10 6 14 10 Q18 14 10 16" stroke="#a78bfa" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  <circle cx="6" cy="14" r="1.5" fill="#a78bfa"/>
                  <circle cx="14" cy="10" r="1.5" fill="#a78bfa"/>
                </svg>
              )
            },
            {
              name:"MCP",
              icon:(
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect width="20" height="20" rx="4" fill="#0a1628"/>
                  <circle cx="10" cy="10" r="3" fill="none" stroke="#5b8fff" strokeWidth="1.2"/>
                  <circle cx="10" cy="4"  r="1.2" fill="#5b8fff"/>
                  <circle cx="10" cy="16" r="1.2" fill="#5b8fff"/>
                  <circle cx="4"  cy="10" r="1.2" fill="#5b8fff"/>
                  <circle cx="16" cy="10" r="1.2" fill="#5b8fff"/>
                  <line x1="10" y1="5.2"  x2="10" y2="7"   stroke="#5b8fff" strokeWidth="0.8"/>
                  <line x1="10" y1="13"   x2="10" y2="14.8" stroke="#5b8fff" strokeWidth="0.8"/>
                  <line x1="5.2" y1="10"  x2="7"  y2="10"  stroke="#5b8fff" strokeWidth="0.8"/>
                  <line x1="13" y1="10"   x2="14.8" y2="10" stroke="#5b8fff" strokeWidth="0.8"/>
                </svg>
              )
            },
          ].map(({name, icon})=>(
            <div key={name} className="flex items-center gap-2.5 px-5 py-3 rounded-xl"
              style={{ background:"var(--bg-surface)", border:"1px solid var(--border)" }}>
              <span className="shrink-0">{icon}</span>
              <span className="text-sm font-semibold" style={{ color:"var(--text-primary)" }}>{name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 text-center px-10" style={{ borderTop:"1px solid var(--border)" }}>
        <p className="text-base font-semibold mb-4" style={{ color:"var(--text-muted)" }}>
          Your customers deserve better context. So does your team.
        </p>
        <h2 className="mx-auto mb-5" style={{ fontSize:"2.6rem", fontWeight:800, lineHeight:1.15, letterSpacing:"-0.02em", maxWidth:580 }}>
          Stop guessing. Start seeing<br />the full picture.
        </h2>
        <p className="mx-auto mb-10 text-lg" style={{ color:"var(--text-muted)", maxWidth:440 }}>
          Connect your first data source and see a context graph in under 2 minutes.
        </p>
        <Link href="/auth/signup"
          className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-xl font-bold text-lg transition-colors">
          Get Started Free →
        </Link>
      </section>

      <footer className="text-center py-6 text-xs" style={{ borderTop:"1px solid var(--border)", color:"var(--text-muted)" }}>
        ContextMesh · Universal Context Graph · Built by Latency Labs
      </footer>
    </div>
  );
}
