"""
ContextMesh Python SDK

Usage:
    from contextmesh import ContextMesh

    cm = ContextMesh(api_key="cm_live_...", base_url="https://your-deployment.com")

    # Track a single event
    cm.track(email="user@example.com", event="purchase", properties={"amount": 1499})

    # Get agent context (for LLM tools)
    ctx = cm.get_agent_context(email="user@example.com")
    print(ctx["context_summary"])
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Any, Optional
from urllib import request, error

__version__ = "0.1.0"


class ContextMeshError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(f"ContextMesh API error {status}: {message}")
        self.status = status


class ContextMesh:
    def __init__(
        self,
        api_key: str,
        base_url: str = "http://localhost:3000",
        vertical: Optional[str] = None,
        debug: bool = False,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.vertical = vertical
        self.debug = debug
        self._headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

    # ── Event Tracking ──────────────────────────────────────────────

    def track(
        self,
        event: str,
        *,
        user_id: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        properties: Optional[dict] = None,
        timestamp: Optional[str] = None,
    ) -> dict:
        """Track a single event."""
        identifiers: dict[str, str] = {}
        if user_id:
            identifiers["user_id"] = user_id
        if email:
            identifiers["email"] = email
        if phone:
            identifiers["phone"] = phone

        body = {
            "event_type": event,
            "identifiers": identifiers,
            "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
            "properties": properties or {},
        }
        return self._post("/api/events", body)

    def track_batch(self, events: list[dict]) -> dict:
        """Track multiple events in one call."""
        normalized = []
        for e in events:
            identifiers: dict[str, str] = {}
            for key in ("user_id", "email", "phone"):
                if key in e:
                    identifiers[key] = e[key]

            normalized.append({
                "event_type": e["event"],
                "identifiers": identifiers,
                "timestamp": e.get("timestamp") or datetime.now(timezone.utc).isoformat(),
                "properties": e.get("properties") or {},
            })

        return self._post("/api/events/batch", {"events": normalized})

    # ── Raw Ingest (any format) ─────────────────────────────────────

    def ingest_raw(
        self,
        data: dict | list,
        client_key: Optional[str] = None,
    ) -> dict:
        """Ingest data in any format — ContextMesh maps it automatically."""
        path = f"/api/ingest/raw?client={client_key}" if client_key else "/api/ingest/raw"
        return self._post(path, data)

    # ── Search & Graph ──────────────────────────────────────────────

    def search(
        self,
        query: str,
        *,
        vertical: Optional[str] = None,
        limit: int = 50,
    ) -> dict:
        """Natural language search returning graph nodes + edges."""
        return self._post("/api/search", {
            "query": query,
            "vertical": vertical or self.vertical,
            "limit": limit,
        })

    # ── Agent Context ───────────────────────────────────────────────

    def get_agent_context(
        self,
        *,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        user_id: Optional[str] = None,
        include: Optional[list[str]] = None,
    ) -> dict:
        """
        Get full context for a user — use this in LLM agent tools.

        Returns:
            profile, recent_events, insights, alerts, context_summary
        """
        body: dict[str, Any] = {}
        if email:
            body["email"] = email
        if phone:
            body["phone"] = phone
        if user_id:
            body["user_id"] = user_id
        if include:
            body["include"] = include

        return self._post("/api/agent/context", body)

    # ── Profiles ────────────────────────────────────────────────────

    def get_profile(self, profile_id: str) -> dict:
        return self._get(f"/api/profiles/{profile_id}")

    # ── Stats ───────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        return self._get("/api/stats")

    # ── Connectors ──────────────────────────────────────────────────

    def sync_connector(self, connector_id: str, since: Optional[str] = None) -> dict:
        body: dict[str, Any] = {"connector_id": connector_id}
        if since:
            body["since"] = since
        return self._post("/api/connectors/sync", body)

    # ── MCP Tool Definition (for LLM agents) ───────────────────────

    @staticmethod
    def mcp_tool_definition() -> dict:
        """Returns the MCP tool definition for use in Claude / OpenAI agents."""
        return {
            "name": "get_customer_context",
            "description": "Retrieve full customer context from ContextMesh — profile, events, insights, and alerts",
            "input_schema": {
                "type": "object",
                "properties": {
                    "email": {"type": "string", "description": "Customer email"},
                    "phone": {"type": "string", "description": "Customer phone number"},
                    "user_id": {"type": "string", "description": "Internal user ID"},
                    "include": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["profile", "events", "insights", "alerts"]},
                        "description": "Fields to include in response",
                    },
                },
            },
        }

    # ── Internal HTTP ───────────────────────────────────────────────

    def _post(self, path: str, body: Any) -> dict:
        if self.debug:
            print(f"[ContextMesh] POST {path}", body)

        data = json.dumps(body).encode("utf-8")
        req = request.Request(
            f"{self.base_url}{path}",
            data=data,
            headers=self._headers,
            method="POST",
        )
        return self._execute(req)

    def _get(self, path: str) -> dict:
        if self.debug:
            print(f"[ContextMesh] GET {path}")

        req = request.Request(
            f"{self.base_url}{path}",
            headers={k: v for k, v in self._headers.items() if k != "Content-Type"},
            method="GET",
        )
        return self._execute(req)

    def _execute(self, req: request.Request) -> dict:
        try:
            with request.urlopen(req, timeout=30) as res:
                return json.loads(res.read().decode("utf-8"))
        except error.HTTPError as e:
            body = e.read().decode("utf-8")
            raise ContextMeshError(e.code, body) from e


# ── Convenience wrapper for LangChain / LlamaIndex agents ──────────

class ContextMeshTool:
    """
    Wrapper that exposes ContextMesh as a callable tool for LangChain or any
    agent framework that expects `tool.run(input: str) -> str`.
    """

    def __init__(self, cm: ContextMesh):
        self.cm = cm
        self.name = "contextmesh_customer_context"
        self.description = (
            "Use this tool to look up a customer's full context including purchase history, "
            "support tickets, alerts, and AI-generated insights. "
            "Input: JSON with email or phone or user_id."
        )

    def run(self, input_str: str) -> str:
        try:
            params = json.loads(input_str)
        except json.JSONDecodeError:
            # Try treating it as an email directly
            params = {"email": input_str.strip()}

        ctx = self.cm.get_agent_context(**params)
        return ctx.get("context_summary", json.dumps(ctx))

    def __call__(self, input_str: str) -> str:
        return self.run(input_str)
