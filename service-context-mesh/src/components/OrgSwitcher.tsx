"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface OrgOption {
  id: string;
  name: string;
  vertical: string;
  plan: string;
}

interface OrgSwitcherProps {
  currentOrgId: string;
  currentVertical: string;
}

export default function OrgSwitcher({ currentOrgId, currentVertical }: OrgSwitcherProps) {
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    if (!userId) {
      // No userId — still show current org as a single option using orgId
      if (currentOrgId) {
        setOrgs([{
          id: currentOrgId,
          name: "My Organization",
          vertical: currentVertical,
          plan: typeof window !== "undefined" ? localStorage.getItem("plan") || "enterprise" : "enterprise",
        }]);
      }
      return;
    }

    fetch(`/api/org?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => setOrgs(data.orgs || []))
      .catch(() => {});
  }, [currentOrgId, currentVertical]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentOrg = orgs.find((o) => o.id === currentOrgId);
  const icon = currentVertical === "retail" ? "🏪" : "🏥";

  const handleSwitch = (org: OrgOption) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("orgId", org.id);
      localStorage.setItem("vertical", org.vertical);
      localStorage.setItem("plan", org.plan);
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-lg px-3 py-1.5 text-sm transition-colors"
      >
        <span suppressHydrationWarning>{icon}</span>
        <span className="text-gray-300 max-w-[120px] truncate">
          {currentOrg?.name || "My Org"}
        </span>
        <span className="text-gray-600 text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSwitch(org)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-800 transition-colors ${
                org.id === currentOrgId ? "bg-gray-800/50" : ""
              }`}
            >
              <span suppressHydrationWarning>{org.vertical === "retail" ? "🏪" : "🏥"}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{org.name}</div>
                <div className="text-xs text-gray-500 capitalize">{org.vertical} · {org.plan}</div>
              </div>
              {org.id === currentOrgId && (
                <span className="text-emerald-400 text-xs">✓</span>
              )}
            </button>
          ))}
          <div className="border-t border-gray-800">
            <button
              onClick={() => { setOpen(false); router.push("/onboarding"); }}
              className="w-full text-left px-4 py-2.5 text-xs text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            >
              + Create New Org
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
