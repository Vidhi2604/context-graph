# ContextMesh — Cloud-Agnostic Best-of-Breed Architecture
## Reference Document (Production Roadmap)

> This document describes the long-term production architecture. 
> For the hackathon build, see PRD.md and LLD.md.
> Items from this doc that made it into hackathon scope:
> - Neo4j as graph store (core of our stack)
> - Neo4j vector index (F9: similarity search)
> - Neo4j graph algorithms (F10: pattern discovery)
> - Identity resolution (Profile + Identity architecture)
> - Relevance scoring (F11)
>
> Items deferred to post-hackathon:
> - Kubernetes / Helm deployment
> - Kafka + Debezium CDC
> - Temporal workflow orchestration
> - Presidio PII redaction
> - Multi-provider LLM routing
> - OPA policy engine
> - Self-hosted models (vLLM)
> - Prometheus/Grafana observability
> - Service mesh (Istio)

---

(Full architecture document preserved below for future reference)

## Why Move Off AWS-Only

The current architecture (if built AWS-only) would be coupled to Neptune, Bedrock, EventBridge, Comprehend, Entity Resolution, Verified Permissions, Step Functions. The three areas where AWS lock-in hurts:

1. **Graph + Vector**: Neptune lacks native vector search with filtered metadata, full-text search, and graph algorithms
2. **Multi-cloud enterprise sales**: Enterprise clients are often Azure-first or GCP-first
3. **On-premises deployment**: Lambda + Step Functions + Neptune cannot be deployed on-prem

## Key Decisions Already Made

- **Neo4j over Neptune** — graph algorithms, native vector, full-text search, on-prem capable
- **Direct LLM API over Bedrock** — no markup, same-day model access
- **Identity Resolution** — custom 3-tier system (deterministic, then Profile+Identity merge, then graph-walk)

## Production Migration Path (Post-Hackathon)

| Sprint | Focus | Key Changes |
|---|---|---|
| 1-2 | Foundation | Kubernetes (EKS), Kafka (Strimzi), Neo4j on K8s |
| 3-4 | Intelligence | Graph algorithms (GDS), Presidio PII, self-hosted Whisper |
| 5-6 | Portability | Debezium CDC, OPA, Prometheus/Grafana, Kong/Envoy |
| 7-8 | Self-hosted ML | Fine-tuned SLM, vLLM serving, on-prem Helm chart |

## Cost Estimate (Phase 1, 5-10 Pilots)

| Component | Monthly Cost |
|---|---|
| Kubernetes (3-5 nodes) | $500-900 |
| Neo4j AuraDB Pro | $500-800 |
| Kafka (Confluent/Strimzi) | $300-600 |
| Anthropic API direct | $600-1,200 |
| GPU node (Whisper + SLM) | $800-1,200 |
| PostgreSQL | $200-400 |
| Redis | $150-250 |
| Temporal | $100-200 |
| Monitoring | $100-200 |
| **Total** | **$3,250-5,750/mo** |
