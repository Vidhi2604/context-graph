"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import OrgSwitcher from "@/components/OrgSwitcher";

const NAV_LINKS = [
  { href: "/dashboard", label: "Search" },
  { href: "/import", label: "Import" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/policies", label: "Drift Analysis" },
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/commitments", label: "Commitments" },
];

interface DashboardHeaderProps {
  orgId?: string;
  vertical?: string;
  plan?: string;
}

export default function DashboardHeader({ orgId = "", vertical = "retail", plan = "" }: DashboardHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-gray-900 px-6 py-3 shrink-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: logo + org switcher */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard"><Logo size={36} showText /></Link>
          {orgId && <OrgSwitcher currentOrgId={orgId} currentVertical={vertical} />}
          {plan && (
            <span className="text-xs font-semibold bg-emerald-900/40 text-emerald-300 px-2.5 py-1 rounded-md capitalize border border-emerald-800/50">
              {plan}
            </span>
          )}
        </div>

        {/* Right: nav */}
        <nav className="flex gap-0.5">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-gray-700 text-white"
                    : "text-gray-300 hover:text-white hover:bg-gray-800"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
