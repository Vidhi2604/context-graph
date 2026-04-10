"use client";

interface EventDetailProps {
  event: {
    id: string;
    event_type: string;
    timestamp: string;
    properties: Record<string, unknown>;
    session_id: string | null;
  } | null;
  onClose: () => void;
}

export default function EventDetail({ event, onClose }: EventDetailProps) {
  if (!event) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-800 p-6 overflow-y-auto z-50 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">Event Details</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xl"
        >
          &times;
        </button>
      </div>

      <div className="space-y-4">
        <Field label="Event Type" value={event.event_type.replace(/_/g, " ")} />
        <Field label="Event ID" value={event.id} mono />
        <Field
          label="Timestamp"
          value={new Date(event.timestamp).toLocaleString()}
        />
        {event.session_id && (
          <Field label="Session" value={event.session_id} mono />
        )}

        {Object.keys(event.properties).length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
              Properties
            </p>
            <pre className="bg-gray-950 rounded-lg p-3 text-xs text-green-400 overflow-x-auto">
              {JSON.stringify(event.properties, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p
        className={`text-white mt-0.5 ${mono ? "font-mono text-sm" : "text-base capitalize"}`}
      >
        {value}
      </p>
    </div>
  );
}
