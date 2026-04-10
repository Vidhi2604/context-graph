import { v4 as uuidv4 } from "uuid";
import { runQuery } from "./neo4j";

export async function createCommitment(
  profileId: string,
  tenantId: string,
  commitment: {
    promise_text: string;
    deadline: string | null;
    assignee: string | null;
    confidence_score?: number;
  },
  sourceEventId?: string
): Promise<string> {
  const commitmentId = `commit_${uuidv4().slice(0, 8)}`;

  await runQuery(
    `
    MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
    CREATE (c:Commitment {
      commitment_id: $commitmentId,
      promise_text: $promiseText,
      deadline: CASE WHEN $deadline IS NOT NULL THEN datetime($deadline) ELSE null END,
      status: "open",
      assignee: $assignee,
      confidence_score: $confidence,
      created_at: datetime(),
      _tenant: $tenantId
    })
    CREATE (p)-[:HAS_COMMITMENT]->(c)
    `,
    {
      profileId,
      tenantId,
      commitmentId,
      promiseText: commitment.promise_text,
      deadline: commitment.deadline,
      assignee: commitment.assignee,
      confidence: commitment.confidence_score ?? 0.7,
    }
  );

  // Link to source event/visit if provided (try both labels)
  if (sourceEventId) {
    await runQuery(
      `
      OPTIONAL MATCH (ev:Event {id: $eventId, _tenant: $tenantId})
      OPTIONAL MATCH (vi:Visit {visit_id: $eventId, _tenant: $tenantId})
      WITH COALESCE(ev, vi) AS source
      WHERE source IS NOT NULL
      MATCH (c:Commitment {commitment_id: $commitmentId, _tenant: $tenantId})
      CREATE (source)-[:CREATED_COMMITMENT]->(c)
      `,
      { eventId: sourceEventId, commitmentId, tenantId }
    );
  }

  return commitmentId;
}

export async function detectBreaches(tenantId: string): Promise<number> {
  const result = await runQuery<{ count: number }>(
    `
    MATCH (c:Commitment {status: "open", _tenant: $tenantId})
    WHERE c.deadline IS NOT NULL AND c.deadline < datetime()
    SET c.status = "breached", c.breached_at = datetime()
    RETURN count(c) AS count
    `,
    { tenantId }
  );
  return result[0]?.count || 0;
}

export async function getCommitments(
  tenantId: string,
  profileId?: string,
  status?: string
): Promise<Record<string, unknown>[]> {
  let cypher = `
    MATCH (c:Commitment {_tenant: $tenantId})
    OPTIONAL MATCH (p:Profile)-[:HAS_COMMITMENT]->(c)
    OPTIONAL MATCH (c)<-[:CREATED_COMMITMENT]-(e)
  `;
  const params: Record<string, unknown> = { tenantId };

  if (profileId) {
    cypher = `
      MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})-[:HAS_COMMITMENT]->(c:Commitment {_tenant: $tenantId})
      OPTIONAL MATCH (c)<-[:CREATED_COMMITMENT]-(e)
    `;
    params.profileId = profileId;
  }

  if (status && status !== "all") {
    cypher += ` WHERE c.status = $status`;
    params.status = status;
  }

  cypher += `
    RETURN c.commitment_id AS id, c.promise_text AS promise,
           c.deadline AS deadline, c.status AS status,
           c.assignee AS assignee, c.confidence_score AS confidence,
           p.name AS customer_name, p.profile_id AS profile_id
    ORDER BY CASE c.status WHEN 'breached' THEN 0 WHEN 'open' THEN 1 ELSE 2 END,
             c.deadline ASC
  `;

  return runQuery(cypher, params);
}
