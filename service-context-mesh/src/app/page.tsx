import Link from "next/link";
import Logo from "@/components/Logo";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-900">
        <Logo size={32} showText />
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <Link href="/api-docs" className="hover:text-white transition-colors">API Docs</Link>
          <Link href="/auth/signin" className="hover:text-white transition-colors">Sign In</Link>
          <Link
            href="/auth/signup"
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-medium transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl">
          {/* Icon hero */}
          <div className="flex justify-center mb-8">
            <Logo size={72} showText={false} />
          </div>

          <h1 className="text-5xl font-bold mb-4 tracking-tight">
            <span className="text-emerald-400">Context</span>Mesh
          </h1>
          <p className="text-xl text-gray-400 mb-3">
            Universal Event Tracking Context Graph
          </p>
          <p className="text-sm text-gray-600 mb-10 max-w-xl mx-auto">
            Capture every user interaction across any system. Build a living connected graph.
            Make patterns visible, queryable, and actionable for AI agents.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/auth/signin"
              className="border border-gray-700 hover:border-gray-500 px-6 py-3 rounded-lg font-medium transition-colors text-gray-300"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-4 mt-16 max-w-3xl w-full text-left">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-emerald-400 mb-1">Ingest</h3>
            <p className="text-sm text-gray-500">
              POST events via API, JS SDK, or connectors (HubSpot, Salesforce, Zoho). Accepts any JSON format.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-emerald-400 mb-1">Visualize</h3>
            <p className="text-sm text-gray-500">
              Interactive context graph powered by React Flow. Profiles, events, products, policies — all connected.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-emerald-400 mb-1">Analyze</h3>
            <p className="text-sm text-gray-500">
              LLM-powered insights. Ask questions in plain English. Push alerts to any CRM via webhooks.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-emerald-400 mb-1">Agent Context</h3>
            <p className="text-sm text-gray-500">
              MCP server + REST API for AI agents. One call returns full profile context with insights.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-emerald-400 mb-1">Multi-Vertical</h3>
            <p className="text-sm text-gray-500">
              Retail and Healthcare schemas built-in. Pluggable vertical registry for any domain.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-emerald-400 mb-1">Identity Resolution</h3>
            <p className="text-sm text-gray-500">
              3-tier deterministic merge across email, phone, crm_id. One profile across all systems.
            </p>
          </div>
        </div>
      </main>

      <footer className="text-center py-6 text-gray-800 text-xs border-t border-gray-900">
        ContextMesh · Universal Context Graph · Built by Latency Labs
      </footer>
    </div>
  );
}
