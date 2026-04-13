"use client";

import { useState } from "react";
import Logo from "@/components/Logo";
import { useSession } from "next-auth/react";


const VERTICALS = [
  {
    id: "retail",
    name: "Retail",
    icon: "🏪",
    description: "E-commerce event tracking, user journeys, returns, payments, policy drift",
    examples: ["Myntra", "Amazon", "Flipkart"],
  },
  {
    id: "healthcare",
    name: "Healthcare",
    icon: "🏥",
    description: "Patient journeys, clinical decisions, readmissions, insurance claims, protocol adherence",
    examples: ["Hospitals", "Clinics", "Health Systems"],
  },
  {
    id: "cx",
    name: "Customer Experience",
    icon: "🎧",
    description: "Support calls, voice transcripts, tickets, agent performance, resolution tracking",
    examples: ["Support Teams", "Call Centers", "CX Platforms"],
  },
];

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "Free",
    features: ["1,000 events/mo", "Basic search", "25 nodes", "7-day timeline"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "",
    features: ["10,000 events/mo", "LLM search", "100 nodes", "90-day timeline", "REST API"],
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "",
    features: ["Unlimited events", "Full reasoning chain", "Unlimited nodes", "MCP + SDK access"],
  },
];

export default function OnboardingPage() {
  const { data: session } = useSession();

  const [orgName, setOrgName] = useState("");
  const [vertical, setVertical] = useState<string | null>(null);
  const [plan, setPlan] = useState("enterprise");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLaunch = async () => {
    if (!orgName || !vertical) {
      setError("Please fill in org name and select a vertical");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const userId = (session?.user as { id?: string })?.id;

      // Create org
      const orgRes = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName, vertical, userId }),
      });

      if (!orgRes.ok) {
        const data = await orgRes.json();
        setError(data.error || "Failed to create organization");
        return;
      }

      const org = await orgRes.json();

      // Set plan
      if (plan !== "starter") {
        await fetch("/api/plan", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-org-id": org.id },
          body: JSON.stringify({ orgId: org.id, plan }),
        });
      }

      // Init schema
      await fetch(`/api/schema`, {
        method: "POST",
        headers: { "x-org-id": org.id },
      });

      // Store org context in localStorage for dashboard
      localStorage.setItem("orgId", org.id);
      localStorage.setItem("vertical", vertical);
      localStorage.setItem("plan", plan);
      // Note: apiKey NOT stored client-side — use server session or settings page to retrieve it
      if (userId) localStorage.setItem("userId", userId);

      // Force full reload so NextAuth session picks up the new org
      window.location.href = "/settings";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center"><Logo size={36} /></div>
          <p className="text-gray-500 mt-2">Set up your organization</p>
        </div>

        {/* Org name */}
        <div>
          <label className="text-sm text-gray-400 block mb-2">Organization Name</label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="e.g. Myntra, City Hospital..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Vertical selection */}
        <div>
          <label className="text-sm text-gray-400 block mb-3">Choose your vertical</label>
          <div className="grid grid-cols-3 gap-4">
            {VERTICALS.map((v) => (
              <button
                key={v.id}
                onClick={() => setVertical(v.id)}
                className={`text-left p-5 rounded-xl border transition-all ${
                  vertical === v.id
                    ? "border-emerald-500 bg-emerald-900/20"
                    : "border-gray-800 bg-gray-900 hover:border-gray-600"
                }`}
              >
                <div className="text-2xl mb-2">{v.icon}</div>
                <div className="font-semibold">{v.name}</div>
                <div className="text-xs text-gray-500 mt-1">{v.description}</div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {v.examples.map((ex) => (
                    <span key={ex} className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                      {ex}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Plan selection */}
        <div>
          <label className="text-sm text-gray-400 block mb-3">Choose your plan</label>
          <div className="grid grid-cols-3 gap-3">
            {PLANS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlan(p.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  plan === p.id
                    ? "border-emerald-500 bg-emerald-900/20"
                    : "border-gray-800 bg-gray-900 hover:border-gray-600"
                } ${p.highlight && plan !== p.id ? "border-gray-600" : ""}`}
              >
                <div className="font-semibold text-sm">{p.name}</div>
                {p.price && <div className="text-emerald-400 text-xs mt-0.5">{p.price}</div>}
                <ul className="mt-2 space-y-1">
                  {p.features.map((f) => (
                    <li key={f} className="text-[10px] text-gray-500">✓ {f}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </div>


        {error && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleLaunch}
          disabled={loading || !orgName || !vertical}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 py-4 rounded-xl font-medium text-lg transition-colors"
        >
          {loading ? "Setting up..." : "Launch Dashboard →"}
        </button>
      </div>
    </div>
  );
}
