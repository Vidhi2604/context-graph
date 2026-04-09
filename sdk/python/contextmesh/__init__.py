"""
ContextMesh Python SDK
Usage:
    from contextmesh import ContextMesh
    cm = ContextMesh(api_key="sk_...", base_url="https://yourapp.com")
    context = cm.get_context(phone="9876543210")
"""
import json
from typing import Optional

try:
    import requests
except ImportError:
    raise ImportError("Install requests: pip install requests")


class ContextMesh:
    def __init__(self, api_key: str, base_url: str = "https://contextmesh.app"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def _get(self, path: str, **params) -> dict:
        res = requests.get(f"{self.base_url}{path}", headers=self.headers, params=params)
        res.raise_for_status()
        return res.json()

    def _post(self, path: str, body: dict = None, trace: bool = False) -> dict:
        url = f"{self.base_url}{path}"
        if trace:
            url += "?trace=true"
        res = requests.post(url, headers=self.headers, json=body or {})
        res.raise_for_status()
        return res.json()

    def get_context(self, trace: bool = False, **identifiers) -> dict:
        """Get full pre-conversation brief for a person.
        Pass any identifier: phone, email, mrn, profile_id, name
        """
        return self._post("/api/agent/context", identifiers, trace=trace)

    def search(self, query: str, limit: int = 50, trace: bool = False) -> dict:
        """Natural language search across the context graph."""
        return self._post("/api/search", {"query": query, "limit": limit}, trace=trace)

    def analyze(self, query: str = None, nodes: list = None, trace: bool = False) -> dict:
        """Get AI insight with reasoning chain for current graph context."""
        return self._post("/api/insights", {"query": query, "nodes": nodes or []}, trace=trace)

    def find_similar(self, node_id: str, node_label: str, limit: int = 5) -> dict:
        """Find profiles/events with similar patterns via structural similarity."""
        return self._post("/api/search/similar", {
            "node_id": node_id,
            "node_label": node_label,
            "limit": limit,
        })

    def track(self, event_type: str, identifiers: dict, **properties) -> dict:
        """Ingest a new event into the context graph."""
        return self._post("/api/events", {
            "event_type": event_type,
            "identifiers": identifiers,
            "properties": properties,
        })

    def track_batch(self, events: list) -> dict:
        """Ingest multiple events at once (max 1000)."""
        return self._post("/api/events/batch", {"events": events})

    def ingest_transcript(self, transcript: list, participants: list = None,
                          call_id: str = None, source: str = "voice_stt") -> dict:
        """Ingest a call/conversation transcript for LLM extraction."""
        return self._post("/api/events/transcript", {
            "transcript": transcript,
            "participants": participants or [],
            "call_id": call_id,
            "source": source,
        })

    def get_alerts(self) -> dict:
        """Get active proactive alerts (policy drift, risk signals, anomaly spikes)."""
        return self._get("/api/alerts")

    def get_commitments(self, profile_id: str = None, status: str = "all") -> dict:
        """Get commitments for a profile."""
        params = {"status": status}
        if profile_id:
            params["profile_id"] = profile_id
        return self._get(f"/api/profiles/{profile_id}" if profile_id else "/api/stats", **params)

    def get_stats(self) -> dict:
        """Get value dashboard metrics."""
        return self._get("/api/stats")

    def sync_connector(self, connector_type: str = None, connector_id: str = None,
                       since: str = None) -> dict:
        """Trigger a connector sync (hubspot, zendesk, or nurix)."""
        body = {}
        if connector_type:
            body["type"] = connector_type
        if connector_id:
            body["connector_id"] = connector_id
        if since:
            body["since"] = since
        return self._post("/api/connectors/sync", body)

    def explore_node(self, node_id: str, node_label: str, depth: int = 2) -> dict:
        """Expand a node's connections in the graph."""
        return self._post("/api/graph/explore", {
            "node_id": node_id,
            "node_label": node_label,
            "depth": depth,
        })
