export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { consumeFromStream, isStreamsConfigured } from "@/lib/streams";
import { logActivity, completeActivity } from "@/lib/activity-log";
import { resolveIdentity } from "@/lib/identity-resolver";
import { runQuery } from "@/lib/neo4j";
import { createCommitment } from "@/lib/commitment-tracker";
import { classifyConfidence, enqueueForReview } from "@/lib/review-queue";
import { auditLog } from "@/lib/audit-log";
import { v4 as uuidv4 } from "uuid";

// In-memory idempotency set (hackathon). Production: Redis with TTL.
const processedKeys = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);

    // Body events take priority (sync mode / direct call)
    // Stream poll used only when no body events provided (async consumer trigger)
    const body = await req.json().catch(() => ({}));
    let messages: Record<string, unknown>[];

    const groupId = `process_${Date.now()}`;

    if (Array.isArray(body.events) && body.events.length > 0) {
      messages = body.events;
    } else if (isStreamsConfigured()) {
      const redisId = logActivity(session.tenantId, {
        layer: "redis",
        label: "Redis XREAD",
        detail: `stream:${session.tenantId} · consuming`,
        status: "running",
        started_at: Date.now(),
        group_id: groupId,
      });
      messages = await consumeFromStream(session.tenantId);
      completeActivity(session.tenantId, redisId, "success", `${messages.length} messages consumed`);
    } else {
      messages = [];
    }

    const isRetail = session.vertical !== "healthcare";

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    let queued = 0;
    let rejected = 0;

    for (const event of messages) {
      try {
        // Idempotency check
        const key = event._idempotency_key as string;
        if (key && processedKeys.has(key)) {
          skipped++;
          continue;
        }

        // ── Confidence gate ──────────────────────────────────────
        const confidence = (event.confidence_score as number) ?? 1.0;
        const decision = classifyConfidence(confidence);

        logActivity(session.tenantId, {
          layer: "scoring", label: "Confidence Gate",
          detail: `score: ${Math.round(confidence * 100)}% → ${decision}`,
          status: decision === "reject" ? "error" : decision === "review" ? "skipped" : "success",
          started_at: Date.now(), ended_at: Date.now(), duration_ms: 0,
          group_id: groupId,
          metadata: {
            confidence_score: confidence,
            decision,
            event_type: String(event.event_type || "unknown"),
            threshold_reject: 0.6,
            threshold_review: 0.85,
          },
        });

        if (decision === "reject") {
          rejected++;
          auditLog({
            tenant_id: session.tenantId,
            action: "event_ingested",
            actor: "system",
            resource_type: "Event",
            resource_id: String(event._idempotency_key || "unknown"),
            metadata: { outcome: "rejected", confidence, reason: "confidence below threshold (0.6)" },
          });
          continue;
        }

        if (decision === "review") {
          enqueueForReview({
            tenantId: session.tenantId,
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
        // decision === "auto_commit" → fall through to normal processing

        // 1. Identity resolution
        const identifiers = (event.identifiers || {}) as Record<string, string>;
        const profileData = (event.profile_data || {}) as Record<string, unknown>;
        const identityActId = logActivity(session.tenantId, {
          layer: "process", label: "Identity Resolution",
          detail: `identifiers: ${Object.keys(identifiers).join(", ")}`,
          status: "running", started_at: Date.now(), group_id: groupId,
        });
        const identityResult = await resolveIdentity(identifiers, session.tenantId, profileData);
        const { profileId } = identityResult;
        completeActivity(session.tenantId, identityActId, "success",
          `${identityResult.isNew ? "new profile created" : identityResult.merged ? "profiles merged" : "existing profile matched"} → ${profileId}`, {
          profile_id: profileId,
          is_new: identityResult.isNew,
          merged: identityResult.merged,
          identities_matched: identityResult.identitiesMatched,
          identities_added: identityResult.identitiesAdded,
          identifier_types: Object.keys(identifiers),
        });

        auditLog({
          tenant_id: session.tenantId,
          action: "event_ingested",
          actor: String(event._source || "api"),
          resource_type: isRetail ? "Event" : "Visit",
          resource_id: profileId,
          metadata: { event_type: event.event_type, confidence, decision: "auto_commit" },
        });

        // 2. Create event/visit node (vertical-aware)
        const nodeId = isRetail ? `evt_${uuidv4().slice(0, 8)}` : `visit_${uuidv4().slice(0, 8)}`;
        const neo4jId = logActivity(session.tenantId, {
          layer: "neo4j",
          label: "Neo4j Write",
          detail: `${isRetail ? "Event" : "Visit"} · ${String(event.event_type || "unknown")} → ${profileId}`,
          status: "running",
          started_at: Date.now(),
          group_id: groupId,
          metadata: {
            node_type: isRetail ? "Event" : "Visit",
            event_type: String(event.event_type || "unknown"),
            profile_id: profileId,
            confidence: confidence,
            decision: "auto_commit",
            channel: event.channel || null,
          },
        });
        const timestamp = (event.timestamp as string) || new Date().toISOString();

        try {
          if (isRetail) {
            await createRetailEvent(nodeId, profileId, event, timestamp, session.tenantId);
          } else {
            await createHealthcareVisit(nodeId, profileId, event, timestamp, session.tenantId);
          }
          completeActivity(session.tenantId, neo4jId, "success", `node: ${nodeId}`, { node_id: nodeId });
        } catch (e) {
          completeActivity(session.tenantId, neo4jId, "error", e instanceof Error ? e.message : "write failed");
          throw e;
        }

        // 3. Link to product (retail) or diagnosis (healthcare)
        const ctxActId = logActivity(session.tenantId, {
          layer: "neo4j", label: "Context Linking",
          detail: `linking ${isRetail ? "product/payment" : "diagnosis/treatment"} to ${nodeId}`,
          status: "running", started_at: Date.now(), group_id: groupId,
        });
        if (isRetail) {
          await linkRetailContext(nodeId, event, session.tenantId);
          const product = event.product as Record<string, unknown> | undefined;
          const payment = event.payment as Record<string, unknown> | undefined;
          completeActivity(session.tenantId, ctxActId, "success",
            `linked: ${[product?.name && `product(${product.name})`, payment?.method && `payment(${payment.method})`].filter(Boolean).join(", ") || "no context"}`, {
            product: product?.name || null,
            category: product?.category || null,
            payment_method: payment?.method || null,
            amount: event.amount || null,
          });
        } else {
          await linkHealthcareContext(nodeId, event, session.tenantId);
          const diagnosis = event.diagnosis as Record<string, unknown> | undefined;
          const treatment = event.treatment as Record<string, unknown> | undefined;
          completeActivity(session.tenantId, ctxActId, "success",
            `linked: ${[diagnosis?.name && `diagnosis(${diagnosis.name})`, treatment?.name && `treatment(${treatment.name})`].filter(Boolean).join(", ") || "no context"}`, {
            diagnosis: diagnosis?.name || null,
            icd_code: diagnosis?.icd_code || null,
            treatment: treatment?.name || null,
          });
        }

        // 4. Link to policy/protocol
        const policy = event.policy as Record<string, unknown> | undefined;
        const protocol = event.protocol as Record<string, unknown> | undefined;
        const policyData = policy || protocol;
        if (policyData?.name) {
          const label = isRetail ? "Policy" : "Protocol";
          const nodeLabel = isRetail ? "Event" : "Visit";
          const idField = isRetail ? "policy_id" : "protocol_id";
          const nodeIdField = isRetail ? "id" : "visit_id";
          const props = (event.properties || {}) as Record<string, unknown>;
          const isException = !!props.exception || !!policyData.deviation;
          const overrideRel = isRetail ? "OVERRODE" : "DEVIATED_FROM";
          const followRel = "GOVERNED_BY";

          await runQuery(
            `
            MATCH (e:${nodeLabel} {${nodeIdField}: $nodeId, _tenant: $tenantId})
            MERGE (pol:${label} {${idField}: $polId, _tenant: $tenantId})
              ON CREATE SET pol.name = $name, pol.version = $version, pol.status = 'active'
            CREATE (e)-[:${isException ? overrideRel : followRel}]->(pol)
            `,
            {
              nodeId,
              tenantId: session.tenantId,
              polId: (policyData[idField] as string) || `pol_${uuidv4().slice(0, 8)}`,
              name: policyData.name,
              version: policyData.version || null,
            }
          );
        }

        // 5. Link agent/provider
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
            `
            MATCH (e:${nodeLabel} {${nodeIdField}: $nodeId, _tenant: $tenantId})
            MERGE (h:${handlerLabel} {${handlerIdField}: $hid, _tenant: $tenantId})
              ON CREATE SET h.name = $name, h.role = $role
            CREATE (e)-[:${rel}]->(h)
            `,
            {
              nodeId,
              tenantId: session.tenantId,
              hid: (handler[handlerIdField] as string) || `handler_${uuidv4().slice(0, 8)}`,
              name: handler.name,
              role: handler.role || handler.specialization || null,
            }
          );
        }

        // 6. Extract commitments
        if (event.event_type === "commitment_made") {
          const props = (event.properties || {}) as Record<string, unknown>;
          // Support both flat and nested properties (raw ingest wraps payload in properties)
          const nested = (props.properties || {}) as Record<string, unknown>;
          const str = (v: unknown) => (typeof v === "string" ? v : null);
          await createCommitment(profileId, session.tenantId, {
            promise_text: str(props.promise_text) || str(nested.promise_text) || "",
            deadline: str(props.deadline) || str(nested.deadline) || null,
            assignee: str(props.assignee) || str(nested.assignee) || null,
            confidence_score: (props.confidence_score || nested.confidence_score) as number,
          }, nodeId);
        }

        // 7. Link NEXT chain (find previous event/visit for this profile)
        const prevLabel = isRetail ? "Event" : "Visit";
        const prevRel = isRetail ? "PERFORMED" : "HAD_VISIT";
        const prevIdField = isRetail ? "id" : "visit_id";
        await runQuery(
          `
          MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})-[:${prevRel}]->(prev:${prevLabel})
          WHERE prev.${prevIdField} <> $nodeId
          WITH prev ORDER BY prev.timestamp DESC LIMIT 1
          MATCH (curr:${prevLabel} {${prevIdField}: $nodeId, _tenant: $tenantId})
          CREATE (prev)-[:NEXT]->(curr)
          `,
          { profileId, nodeId, tenantId: session.tenantId }
        ).catch(() => {}); // No previous event is fine

        // Final event summary
        logActivity(session.tenantId, {
          layer: "ingest", label: "Event Committed",
          detail: `${String(event.event_type || "unknown")} · profile: ${profileId} · node: ${nodeId}`,
          status: "success", started_at: Date.now(), ended_at: Date.now(), duration_ms: 0,
          group_id: groupId,
          metadata: {
            node_id: nodeId,
            profile_id: profileId,
            event_type: String(event.event_type || "unknown"),
            timestamp: timestamp,
            channel: event.channel || null,
            amount: event.amount || null,
            is_new_profile: identityResult.isNew,
            source: event._source || "api",
          },
        });

        // Mark as processed
        if (key) processedKeys.add(key);
        processed++;
      } catch (err) {
        console.error("Event processing error:", err);
        failed++;
      }
    }

    return NextResponse.json({ processed, skipped, failed, queued, rejected, total: messages.length });
  } catch (error) {
    return errorResponse(error);
  }
}

// ── Retail: creates :Event node ──
async function createRetailEvent(
  eventId: string, profileId: string,
  event: Record<string, unknown>, timestamp: string, tenantId: string
) {
  await runQuery(
    `
    MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
    CREATE (e:Event {
      id: $eventId,
      event_type: $eventType,
      timestamp: datetime($timestamp),
      status: $status,
      amount: $amount,
      channel: $channel,
      payment_method: $paymentMethod,
      exception: $exception,
      confidence_score: $confidence,
      properties: $properties,
      _ingest_source: $ingestSource,
      _tenant: $tenantId,
      created_at: datetime()
    })
    CREATE (p)-[:PERFORMED]->(e)
    `,
    {
      profileId, tenantId, eventId,
      eventType: (event.event_type as string) || "unknown",
      timestamp,
      status: (event.status as string) || "completed",
      amount: (event.amount as number) || null,
      channel: (event.channel as string) || null,
      paymentMethod: (event.payment as Record<string,unknown>)?.method as string
        || (event.properties as Record<string,unknown>)?.payment_method as string
        || null,
      exception: !!(event.properties as Record<string, unknown>)?.exception,
      confidence: (event.confidence_score as number) || 1.0,
      properties: JSON.stringify(event.properties || {}),
      ingestSource: (event._ingest_source as string) || (event._source as string) || "csv_import",
    }
  );
}

// ── Healthcare: creates :Visit node ──
async function createHealthcareVisit(
  visitId: string, profileId: string,
  event: Record<string, unknown>, timestamp: string, tenantId: string
) {
  const visit = (event.visit || {}) as Record<string, unknown>;
  await runQuery(
    `
    MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
    CREATE (v:Visit {
      visit_id: $visitId,
      type: $visitType,
      timestamp: datetime($timestamp),
      department: $department,
      status: $visitStatus,
      priority: $priority,
      duration_hours: $duration,
      confidence_score: $confidence,
      _tenant: $tenantId,
      created_at: datetime()
    })
    CREATE (p)-[:HAD_VISIT]->(v)
    `,
    {
      profileId, tenantId, visitId,
      visitType: (visit.type as string) || (event.event_type as string) || "Outpatient",
      timestamp,
      department: (visit.department as string) || null,
      visitStatus: (visit.status as string) || "Discharged",
      priority: (visit.priority as string) || "Medium",
      duration: (visit.duration_hours as number) || null,
      confidence: (event.confidence_score as number) || 1.0,
    }
  );
}

// ── Retail context: product, payment ──
async function linkRetailContext(eventId: string, event: Record<string, unknown>, tenantId: string) {
  const product = event.product as Record<string, unknown> | undefined;
  if (product?.name) {
    await runQuery(
      `
      MATCH (e:Event {id: $eventId, _tenant: $tenantId})
      MERGE (prod:Product {product_id: $prodId})
        ON CREATE SET prod.name = $name, prod.category = $category,
                      prod.brand = $brand, prod.price = $price, prod._tenant = $tenantId
        ON MATCH SET prod.name = COALESCE($name, prod.name)
      WITH e, prod
      WHERE NOT (e)-[:INVOLVES]->(prod)
      CREATE (e)-[:INVOLVES]->(prod)
      `,
      {
        eventId, tenantId,
        prodId: (product.product_id as string) || `prod_${uuidv4().slice(0, 8)}`,
        name: product.name, category: product.category || null,
        brand: product.brand || null, price: product.price || null,
      }
    );
  }

  const payment = event.payment as Record<string, unknown> | undefined;
  if (payment?.method) {
    await runQuery(
      `
      MATCH (e:Event {id: $eventId, _tenant: $tenantId})
      CREATE (pay:Payment {
        payment_id: $payId, method: $method, amount: $amount,
        status: $payStatus, _tenant: $tenantId
      })
      CREATE (e)-[:PAID_VIA]->(pay)
      `,
      {
        eventId, tenantId,
        payId: `pay_${uuidv4().slice(0, 8)}`,
        method: payment.method, amount: payment.amount || null,
        payStatus: payment.status || "completed",
      }
    );
  }
}

// ── Healthcare context: diagnosis, treatment, medication, insurance, department ──
async function linkHealthcareContext(visitId: string, event: Record<string, unknown>, tenantId: string) {
  const diagnosis = event.diagnosis as Record<string, unknown> | undefined;
  if (diagnosis?.name) {
    await runQuery(
      `
      MATCH (v:Visit {visit_id: $visitId, _tenant: $tenantId})
      MERGE (d:Diagnosis {name: $name, _tenant: $tenantId})
        ON CREATE SET d.diagnosis_id = $did, d.icd_code = $icd,
                      d.severity = $severity, d.chronic = $chronic
      CREATE (v)-[:DIAGNOSED_WITH]->(d)
      `,
      {
        visitId, tenantId,
        did: (diagnosis.diagnosis_id as string) || `diag_${uuidv4().slice(0, 8)}`,
        name: diagnosis.name, icd: diagnosis.icd_code || null,
        severity: diagnosis.severity || null, chronic: diagnosis.chronic || false,
      }
    );
  }

  const treatment = event.treatment as Record<string, unknown> | undefined;
  if (treatment?.name) {
    await runQuery(
      `
      MATCH (v:Visit {visit_id: $visitId, _tenant: $tenantId})
      CREATE (tr:Treatment {
        treatment_id: $tid, name: $name, type: $type,
        cost: $cost, duration_hours: $duration, _tenant: $tenantId
      })
      CREATE (v)-[:TREATED_WITH]->(tr)
      `,
      {
        visitId, tenantId,
        tid: (treatment.treatment_id as string) || `treat_${uuidv4().slice(0, 8)}`,
        name: treatment.name, type: treatment.type || null,
        cost: treatment.cost || null, duration: treatment.duration_hours || null,
      }
    );
  }

  const medications = event.medications as Record<string, unknown>[] | undefined;
  if (medications?.length) {
    for (const med of medications) {
      await runQuery(
        `
        MATCH (v:Visit {visit_id: $visitId, _tenant: $tenantId})
        MERGE (m:Medication {name: $name, _tenant: $tenantId})
          ON CREATE SET m.medication_id = $mid, m.dosage = $dosage,
                        m.frequency = $freq, m.duration_days = $dur
        CREATE (v)-[:PRESCRIBED]->(m)
        `,
        {
          visitId, tenantId,
          mid: (med.medication_id as string) || `med_${uuidv4().slice(0, 8)}`,
          name: med.name, dosage: med.dosage || null,
          freq: med.frequency || null, dur: med.duration_days || null,
        }
      );
    }
  }

  const claim = event.insurance_claim as Record<string, unknown> | undefined;
  if (claim?.amount) {
    await runQuery(
      `
      MATCH (v:Visit {visit_id: $visitId, _tenant: $tenantId})
      CREATE (ic:InsuranceClaim {
        claim_id: $cid, amount: $amount, status: $status,
        denial_reason: $reason, payer: $payer, _tenant: $tenantId
      })
      CREATE (v)-[:CLAIMED_VIA]->(ic)
      `,
      {
        visitId, tenantId,
        cid: (claim.claim_id as string) || `clm_${uuidv4().slice(0, 8)}`,
        amount: claim.amount, status: claim.status || "Pending",
        reason: claim.denial_reason || null, payer: claim.payer || null,
      }
    );
  }

  // Link to department
  const visit = (event.visit || {}) as Record<string, unknown>;
  if (visit.department) {
    await runQuery(
      `
      MATCH (v:Visit {visit_id: $visitId, _tenant: $tenantId})
      MERGE (d:Department {name: $dept, _tenant: $tenantId})
        ON CREATE SET d.department_id = $did, d.type = 'Clinical'
      CREATE (v)-[:IN_DEPARTMENT]->(d)
      `,
      { visitId, tenantId, dept: visit.department, did: `dept_${uuidv4().slice(0, 8)}` }
    );
  }
}
