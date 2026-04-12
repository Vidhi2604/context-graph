import { resolveIdentity } from "@/lib/identity-resolver";
import { runQuery } from "@/lib/neo4j";
import { createCommitment } from "@/lib/commitment-tracker";
import { classifyConfidence, enqueueForReview } from "@/lib/review-queue";
import { logActivity, completeActivity } from "@/lib/activity-log";
import { auditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

async function isAlreadyProcessed(key: string, tenantId: string): Promise<boolean> {
  try {
    const existing = await prisma.idempotencyKey.findUnique({ where: { key_tenantId: { key, tenantId } } });
    return !!existing;
  } catch { return false; }
}

async function markProcessed(key: string, tenantId: string): Promise<void> {
  try {
    await prisma.idempotencyKey.upsert({
      where: { key_tenantId: { key, tenantId } },
      create: { key, tenantId, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) }, // 7 days
      update: {},
    });
  } catch { /* non-critical */ }
}

export async function processEventsBatch(
  messages: Record<string, unknown>[],
  tenantId: string,
  orgId: string,
  vertical: string
): Promise<{ processed: number; skipped: number; failed: number; queued: number; rejected: number }> {
  const isRetail = vertical !== "healthcare";
  const groupId = `process_${Date.now()}`;

  console.log(`[processEventsBatch] START: ${messages.length} events, tenant: ${tenantId}, vertical: ${vertical}`);
  let processed = 0, skipped = 0, failed = 0, queued = 0, rejected = 0;

  for (const event of messages) {
    try {
      const key = event._idempotency_key as string;
      if (key && await isAlreadyProcessed(key, tenantId)) { skipped++; continue; }

      const confidence = (event.confidence_score as number) ?? 1.0;
      const decision = classifyConfidence(confidence);

      logActivity(tenantId, {
        layer: "scoring", label: "Confidence Gate",
        detail: `score: ${Math.round(confidence * 100)}% → ${decision}`,
        status: decision === "reject" ? "error" : decision === "review" ? "skipped" : "success",
        started_at: Date.now(), ended_at: Date.now(), duration_ms: 0,
        group_id: groupId,
        metadata: { confidence_score: confidence, decision, event_type: String(event.event_type || "unknown") },
      });

      if (decision === "reject") {
        rejected++;
        auditLog({ tenant_id: tenantId, action: "event_ingested", actor: "system", resource_type: "Event", resource_id: "unknown", metadata: { outcome: "rejected", confidence } });
        continue;
      }

      if (decision === "review") {
        enqueueForReview({
          tenantId,
          source: (event._source as "transcript" | "raw" | "connector" | "api") || "api",
          confidence_score: confidence,
          event_type: String(event.event_type || "unknown"),
          identifiers: (event.identifiers as Record<string, string>) || {},
          profile_data: event.profile_data as Record<string, unknown>,
          payload: event,
          reason: `Confidence ${Math.round(confidence * 100)}% is below auto-commit threshold (85%)`,
        });
        queued++;
        continue;
      }

      const identifiers = (event.identifiers || {}) as Record<string, string>;
      const profileData = (event.profile_data || {}) as Record<string, unknown>;
      const identityActId = logActivity(tenantId, {
        layer: "process", label: "Identity Resolution",
        detail: `identifiers: ${Object.keys(identifiers).join(", ")}`,
        status: "running", started_at: Date.now(), group_id: groupId,
      });
      const identityResult = await resolveIdentity(identifiers, tenantId, profileData);
      const { profileId } = identityResult;
      completeActivity(tenantId, identityActId, "success",
        `${identityResult.isNew ? "new" : "existing"} → ${profileId}`,
        { profile_id: profileId, is_new: identityResult.isNew }
      );

      auditLog({ tenant_id: tenantId, action: "event_ingested", actor: String(event._source || "api"), resource_type: isRetail ? "Event" : "Visit", resource_id: profileId, metadata: { event_type: event.event_type, confidence, decision: "auto_commit" } });

      const nodeId = isRetail ? `evt_${uuidv4().slice(0, 8)}` : `visit_${uuidv4().slice(0, 8)}`;
      const neo4jId = logActivity(tenantId, { layer: "neo4j", label: "Neo4j Write", detail: `${isRetail ? "Event" : "Visit"} · ${String(event.event_type || "unknown")}`, status: "running", started_at: Date.now(), group_id: groupId });
      const timestamp = (event.timestamp as string) || new Date().toISOString();

      try {
        if (isRetail) {
          await createRetailEvent(nodeId, profileId, event, timestamp, tenantId);
        } else {
          await createHealthcareVisit(nodeId, profileId, event, timestamp, tenantId);
        }
        completeActivity(tenantId, neo4jId, "success", `node: ${nodeId}`, { node_id: nodeId });
      } catch (e) {
        completeActivity(tenantId, neo4jId, "error", e instanceof Error ? e.message : "write failed");
        throw e;
      }

      if (isRetail) await linkRetailContext(nodeId, event, tenantId);
      else await linkHealthcareContext(nodeId, event, tenantId);

      const agent = event.agent as Record<string, unknown> | undefined;
      const provider = event.provider as Record<string, unknown> | undefined;
      const handler = agent || provider;
      if (handler?.name) {
        const handlerLabel = isRetail ? "Agent" : "Provider";
        const nodeLabel = isRetail ? "Event" : "Visit";
        const nodeIdField = isRetail ? "id" : "visit_id";
        const handlerIdField = isRetail ? "agent_id" : "provider_id";
        const rel = isRetail ? "HANDLED_BY" : "ATTENDED_BY";
        await runQuery(
          `MATCH (e:${nodeLabel} {${nodeIdField}: $nodeId, _tenant: $tenantId})
           MERGE (h:${handlerLabel} {${handlerIdField}: $hid, _tenant: $tenantId})
             ON CREATE SET h.name = $name, h.role = $role
           CREATE (e)-[:${rel}]->(h)`,
          { nodeId, tenantId, hid: (handler[handlerIdField] as string) || `handler_${uuidv4().slice(0, 8)}`, name: handler.name, role: handler.role || handler.specialization || null }
        );
      }

      // NEXT chain
      const prevLabel = isRetail ? "Event" : "Visit";
      const prevRel = isRetail ? "PERFORMED" : "HAD_VISIT";
      const prevIdField = isRetail ? "id" : "visit_id";
      await runQuery(
        `MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})-[:${prevRel}]->(prev:${prevLabel})
         WHERE prev.${prevIdField} <> $nodeId
         WITH prev ORDER BY prev.timestamp DESC LIMIT 1
         MATCH (curr:${prevLabel} {${prevIdField}: $nodeId, _tenant: $tenantId})
         CREATE (prev)-[:NEXT]->(curr)`,
        { profileId, nodeId, tenantId }
      ).catch(() => {});

      if (key) await markProcessed(key, tenantId);
      processed++;
    } catch (err) {
      console.error("Event processing error:", err);
      failed++;
    }
  }

  return { processed, skipped, failed, queued, rejected };
}

async function createRetailEvent(eventId: string, profileId: string, event: Record<string, unknown>, timestamp: string, tenantId: string) {
  await runQuery(
    `MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
     CREATE (e:Event { id: $eventId, event_type: $eventType, timestamp: datetime($timestamp), status: $status, amount: $amount, channel: $channel, payment_method: $paymentMethod, exception: $exception, confidence_score: $confidence, properties: $properties, _ingest_source: $ingestSource, _tenant: $tenantId, created_at: datetime() })
     CREATE (p)-[:PERFORMED]->(e)`,
    {
      profileId, tenantId, eventId,
      eventType: (event.event_type as string) || "unknown",
      timestamp,
      status: (event.status as string) || "completed",
      amount: (event.amount as number) || null,
      channel: (event.channel as string) || null,
      paymentMethod: (event.payment as Record<string,unknown>)?.method as string || (event.properties as Record<string,unknown>)?.payment_method as string || null,
      exception: !!(event.properties as Record<string, unknown>)?.exception,
      confidence: (event.confidence_score as number) || 1.0,
      properties: JSON.stringify(event.properties || {}),
      ingestSource: (event._ingest_source as string) || "api",
    }
  );
}

async function createHealthcareVisit(visitId: string, profileId: string, event: Record<string, unknown>, timestamp: string, tenantId: string) {
  const visit = (event.visit || {}) as Record<string, unknown>;
  await runQuery(
    `MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
     CREATE (v:Visit { visit_id: $visitId, type: $visitType, timestamp: datetime($timestamp), department: $department, status: $visitStatus, priority: $priority, duration_hours: $duration, confidence_score: $confidence, _ingest_source: $ingestSource, _tenant: $tenantId, created_at: datetime() })
     CREATE (p)-[:HAD_VISIT]->(v)`,
    { profileId, tenantId, visitId, visitType: (visit.type as string) || (event.event_type as string) || "Outpatient", timestamp, department: (visit.department as string) || null, visitStatus: (visit.status as string) || "Discharged", priority: (visit.priority as string) || "Medium", duration: (visit.duration_hours as number) || null, confidence: (event.confidence_score as number) || 1.0, ingestSource: (event._ingest_source as string) || "api" }
  );
}

async function linkRetailContext(eventId: string, event: Record<string, unknown>, tenantId: string) {
  const product = event.product as Record<string, unknown> | undefined;
  if (product?.name) {
    await runQuery(
      `MATCH (e:Event {id: $eventId, _tenant: $tenantId})
       MERGE (prod:Product {product_id: $prodId, _tenant: $tenantId})
         ON CREATE SET prod.name = $name, prod.category = $category, prod.brand = $brand, prod.price = $price
       CREATE (e)-[:INVOLVES]->(prod)`,
      { eventId, tenantId, prodId: (product.product_id as string) || `prod_${uuidv4().slice(0, 8)}`, name: product.name, category: product.category || null, brand: product.brand || null, price: product.price || null }
    );
  }
  const payment = event.payment as Record<string, unknown> | undefined;
  if (payment?.method) {
    await runQuery(
      `MATCH (e:Event {id: $eventId, _tenant: $tenantId})
       CREATE (pay:Payment { payment_id: $payId, method: $method, amount: $amount, status: $payStatus, _tenant: $tenantId })
       CREATE (e)-[:PAID_VIA]->(pay)`,
      { eventId, tenantId, payId: `pay_${uuidv4().slice(0, 8)}`, method: payment.method, amount: payment.amount || null, payStatus: payment.status || "completed" }
    );
  }
}

async function linkHealthcareContext(visitId: string, event: Record<string, unknown>, tenantId: string) {
  const diagnosis = event.diagnosis as Record<string, unknown> | undefined;
  if (diagnosis?.name) {
    await runQuery(
      `MATCH (v:Visit {visit_id: $visitId, _tenant: $tenantId})
       MERGE (d:Diagnosis {name: $name, _tenant: $tenantId})
         ON CREATE SET d.diagnosis_id = $did, d.icd_code = $icd, d.severity = $severity, d.chronic = $chronic
       CREATE (v)-[:DIAGNOSED_WITH]->(d)`,
      { visitId, tenantId, did: (diagnosis.diagnosis_id as string) || `diag_${uuidv4().slice(0, 8)}`, name: diagnosis.name, icd: diagnosis.icd_code || null, severity: diagnosis.severity || null, chronic: diagnosis.chronic || false }
    );
  }
}
