/**
 * pattern-discovery.ts — Graph algorithm-based pattern detection
 *
 * Uses graphology (JS graph library) for community detection (Louvain)
 * and PageRank. Writes results back to Neo4j Profile nodes.
 * Does NOT require Neo4j GDS — works on Aura free tier.
 */

import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import pagerank from "graphology-metrics/centrality/pagerank";
import { runQuery } from "./neo4j";
import { claudeReason } from "./llm";

const MIN_CLUSTER_SIZE = 3;

interface ProfileNode { profile_id: string; name: string; tier: string; }
interface CoEventEdge { profile_a: string; profile_b: string; weight: number; }
interface ClusterSummaryRow {
  community_id: number; cluster_size: number;
  names: string[]; tiers: string[]; event_types: string[];
}

export interface PatternResult {
  cluster_id: number;
  cluster_size: number;
  summary: string;
  common_factors: string[];
}

export async function runPatternDiscovery(
  tenantId: string,
  vertical: string
): Promise<PatternResult[]> {
  // 1. Fetch Profile nodes
  const profiles = await runQuery<ProfileNode>(
    `MATCH (p:Profile {_tenant: $tenantId})
     WHERE p.archived IS NULL
     RETURN p.profile_id AS profile_id, p.name AS name, p.tier AS tier
     LIMIT 1000`,
    { tenantId }
  );

  if (profiles.length === 0) return [];

  // 2. Fetch co-event edges (Profiles sharing event types)
  const eventLabel = vertical === "retail" ? "Event" : "Visit";
  const relType = vertical === "retail" ? "PERFORMED" : "HAD_VISIT";
  const typeField = vertical === "retail" ? "e.event_type" : "e.type";

  const coEdges = await runQuery<CoEventEdge>(
    `MATCH (pa:Profile {_tenant: $tenantId})-[:${relType}]->(e:${eventLabel})
     MATCH (pb:Profile {_tenant: $tenantId})-[:${relType}]->(e2:${eventLabel})
     WHERE pa.profile_id < pb.profile_id
       AND ${typeField} = e2.${vertical === "retail" ? "event_type" : "type"}
       AND pa.archived IS NULL AND pb.archived IS NULL
     WITH pa.profile_id AS profile_a, pb.profile_id AS profile_b, count(*) AS weight
     WHERE weight >= 2
     RETURN profile_a, profile_b, weight
     LIMIT 5000`,
    { tenantId }
  );

  // 3. Build in-memory graph
  const graph = new Graph({ type: "undirected" });

  for (const p of profiles) {
    if (!graph.hasNode(p.profile_id)) {
      graph.addNode(p.profile_id, { name: p.name, tier: p.tier });
    }
  }

  for (const e of coEdges) {
    if (graph.hasNode(e.profile_a) && graph.hasNode(e.profile_b)) {
      if (!graph.hasEdge(e.profile_a, e.profile_b)) {
        graph.addEdge(e.profile_a, e.profile_b, { weight: e.weight });
      }
    }
  }

  if (graph.order === 0) return [];

  // 4. Louvain community detection
  const communities = louvain(graph, { resolution: 1.0 });

  // 5. PageRank
  const scores = pagerank(graph, { alpha: 0.85, getEdgeWeight: "weight" });

  // 6. Write community_id + page_rank back to Neo4j
  const updates: Promise<unknown>[] = [];
  for (const profileId of graph.nodes()) {
    updates.push(
      runQuery(
        `MATCH (p:Profile {_tenant: $tenantId, profile_id: $profileId})
         SET p.community_id = $communityId, p.page_rank = $pageRank`,
        { tenantId, profileId, communityId: communities[profileId], pageRank: scores[profileId] ?? 0 }
      )
    );
  }
  await Promise.all(updates);

  // 7. Query cluster summaries
  const clusters = await runQuery<ClusterSummaryRow>(
    `MATCH (p:Profile {_tenant: $tenantId})
     WHERE p.community_id IS NOT NULL
     WITH p.community_id AS community_id, collect(p) AS members
     WHERE size(members) >= $minSize
     UNWIND members AS p
     OPTIONAL MATCH (p)-[:PERFORMED|HAD_VISIT]->(e)
     RETURN community_id,
            size(members) AS cluster_size,
            collect(DISTINCT p.name)[..10] AS names,
            collect(DISTINCT p.tier)[..5] AS tiers,
            collect(DISTINCT coalesce(e.event_type, e.type))[..10] AS event_types
     ORDER BY cluster_size DESC
     LIMIT 20`,
    { tenantId, minSize: MIN_CLUSTER_SIZE }
  );

  const results = await Promise.all(
    clusters.map((c) => generateClusterSummary(c, vertical))
  );

  return results;
}

async function generateClusterSummary(
  cluster: ClusterSummaryRow,
  vertical: string
): Promise<PatternResult> {
  const prompt = `You are analyzing a behavioral cluster in a ${vertical} context graph.

Cluster size: ${cluster.cluster_size} profiles
Tiers/segments: ${cluster.tiers.join(", ")}
Common event types: ${cluster.event_types.join(", ")}

Provide a concise 1-2 sentence summary and 2-3 common factors.
Return JSON: { "summary": "...", "common_factors": ["...", "..."] }`;

  const fallback: PatternResult = {
    cluster_id: cluster.community_id,
    cluster_size: cluster.cluster_size,
    summary: `Cluster of ${cluster.cluster_size} profiles sharing common ${vertical} behaviors.`,
    common_factors: Array.isArray(cluster.event_types) ? cluster.event_types.slice(0, 3) : [],
  };

  try {
    const raw = await claudeReason(prompt, "You are a behavioral analyst. Return only valid JSON.");
    const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return fallback;
    }

    const summary = typeof parsed.summary === "string" && parsed.summary
      ? parsed.summary
      : fallback.summary;

    const common_factors = Array.isArray(parsed.common_factors) && parsed.common_factors.length > 0
      ? (parsed.common_factors as string[]).filter((f) => typeof f === "string")
      : fallback.common_factors;

    return { cluster_id: cluster.community_id, cluster_size: cluster.cluster_size, summary, common_factors };
  } catch {
    return fallback;
  }
}
