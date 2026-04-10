# ContextMesh — Team Latency Labs

**The Decision Intelligence Layer for Enterprise**

ContextMesh is a multi-tenant, multi-vertical context graph platform that captures every interaction, decision, and event — building a living, queryable graph that makes patterns visible, decisions traceable, and AI agents smarter over time.

## What It Does

- **Natural language search** over a Neo4j graph of customer journeys
- **AI-powered insights** via Claude (Anthropic) — pattern detection, anomaly alerts, decision tracing
- **Agent context API** — gives AI agents full customer history in one call
- **MCP server** — plug-and-play integration for any AI agent
- **Multi-vertical** — Retail and Healthcare out of the box

## Tech Stack

- **Frontend**: Next.js 14, React Flow, Tailwind CSS
- **Graph DB**: Neo4j Aura
- **LLM**: Anthropic Claude (Haiku + Sonnet)
- **Auth**: NextAuth.js
- **Cache**: Upstash Redis

## Services

- `service-context-mesh/` — Next.js application (full stack)

## Docs

- [PRD](docs/PRD.md)
- [LLD](docs/LLD.md)
