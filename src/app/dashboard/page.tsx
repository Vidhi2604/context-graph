"use client";

import { useState } from "react";
import JourneyGraph from "@/components/JourneyGraph";
import EventDetail from "@/components/EventDetail";

interface EventNode {
  id: string;
  event_type: string;
  timestamp: string;
  properties: Record<string, unknown>;
  session_id: string | null;
}

export default function DashboardPage() {
  const [userId, setUserId] = useState("");
  const [events, setEvents] = useState<EventNode[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookupUser() {
    if (!userId.trim()) return;
    setLoading(true);
    setError(null);
    setEvents([]);
    setSelectedEvent(null);

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/events`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "User not found");
        return;
      }
      const data = await res.json();
      setEvents(data.events);
    } catch {
      setError("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">
              <span className="text-emerald-400">Context</span>Mesh
            </h1>
            <p className="text-xs text-gray-500">Journey Explorer</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Enter user ID..."
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookupUser()}
              className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm w-72 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={lookupUser}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? "Loading..." : "Lookup"}
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {events.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Journey for{" "}
                <span className="text-emerald-400 font-mono">{userId}</span>
              </h2>
              <span className="text-sm text-gray-500">
                {events.length} events
              </span>
            </div>
            <JourneyGraph
              events={events}
              onNodeClick={(evt) => setSelectedEvent(evt)}
            />

            {/* Timeline list */}
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                Event Timeline
              </h3>
              <div className="space-y-2">
                {events.map((evt, i) => (
                  <button
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className="w-full text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-4 transition-colors"
                  >
                    <span className="text-xs text-gray-600 font-mono w-6">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium capitalize flex-1">
                      {evt.event_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {events.length === 0 && !error && !loading && (
          <div className="text-center py-32">
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold mb-2">Journey Explorer</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Enter a user ID above to visualize their complete event journey as
              an interactive graph.
            </p>
          </div>
        )}
      </main>

      {/* Detail panel */}
      <EventDetail
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
