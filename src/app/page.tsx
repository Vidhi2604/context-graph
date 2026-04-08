import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold mb-4">
          <span className="text-emerald-400">Context</span>Mesh
        </h1>
        <p className="text-xl text-gray-400 mb-2">
          Universal Event Tracking Context Graph
        </p>
        <p className="text-sm text-gray-600 mb-10">
          Capture every user interaction. Build a living graph. Make patterns
          visible and queryable.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Open Dashboard
          </Link>
          <a
            href="/api/events"
            className="border border-gray-700 hover:border-gray-500 px-6 py-3 rounded-lg font-medium transition-colors text-gray-300"
          >
            API Docs
          </a>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-4 mt-16 text-left">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-emerald-400 mb-1">Ingest</h3>
            <p className="text-sm text-gray-500">
              POST events via API or JS SDK. Auto-captures sessions, page views,
              clicks.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-emerald-400 mb-1">Visualize</h3>
            <p className="text-sm text-gray-500">
              Interactive journey graphs powered by React Flow. See every user
              path.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-emerald-400 mb-1">Analyze</h3>
            <p className="text-sm text-gray-500">
              LLM-powered insights. Ask questions about user journeys in plain
              English.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
