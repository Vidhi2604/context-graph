import { runQuery } from "@/lib/neo4j";
import { v4 as uuidv4 } from "uuid";

const CITIES = ["Bangalore", "Mumbai", "Delhi", "Chennai", "Hyderabad"];
const TIERS = ["Bronze", "Silver", "Gold", "Platinum"];
const PAYMENT_METHODS = ["COD", "UPI", "Credit Card", "Debit Card"];

const PRODUCTS = [
  { product_id: "nike_air_max_001", name: "Nike Air Max", category: "Footwear", brand: "Nike", price: 8499 },
  { product_id: "adidas_ultraboost_001", name: "Adidas Ultraboost", category: "Footwear", brand: "Adidas", price: 12999 },
  { product_id: "puma_rsx_001", name: "Puma RS-X", category: "Footwear", brand: "Puma", price: 6499 },
  { product_id: "converse_chuck_001", name: "Converse Chuck Taylor", category: "Footwear", brand: "Converse", price: 3999 },
  { product_id: "nike_pegasus_001", name: "Nike Pegasus", category: "Footwear", brand: "Nike", price: 9999 },
  { product_id: "levis_jacket_001", name: "Levis Denim Jacket", category: "Apparel", brand: "Levis", price: 4599 },
  { product_id: "uspolo_shirt_001", name: "U.S. Polo Shirt", category: "Apparel", brand: "U.S. Polo", price: 1899 },
  { product_id: "hm_hoodie_001", name: "H&M Hoodie", category: "Apparel", brand: "H&M", price: 2499 },
  { product_id: "zara_tshirt_001", name: "Zara Basic T-Shirt", category: "Apparel", brand: "Zara", price: 1299 },
  { product_id: "tommy_polo_001", name: "Tommy Hilfiger Polo", category: "Apparel", brand: "Tommy", price: 3499 },
  { product_id: "fossil_watch_001", name: "Fossil Watch", category: "Accessories", brand: "Fossil", price: 7999 },
  { product_id: "rayban_aviator_001", name: "Ray-Ban Aviator", category: "Accessories", brand: "Ray-Ban", price: 5999 },
  { product_id: "wildcraft_backpack_001", name: "Wildcraft Backpack", category: "Accessories", brand: "Wildcraft", price: 2299 },
  { product_id: "tommy_wallet_001", name: "Tommy Wallet", category: "Accessories", brand: "Tommy", price: 1999 },
];

const AGENTS = [
  { agent_id: "agent_ravi_001", name: "Ravi K.", role: "L2 Support", team: "Returns" },
  { agent_id: "agent_anita_001", name: "Anita S.", role: "L1 Support", team: "General" },
  { agent_id: "agent_deepak_001", name: "Deepak M.", role: "L2 Support", team: "Returns" },
  { agent_id: "agent_priya_r_001", name: "Priya R.", role: "L1 Support", team: "General" },
  { agent_id: "agent_vikram_001", name: "Vikram T.", role: "Manager", team: "Returns" },
];

const POLICIES = [
  { policy_id: "return_policy_v3.1", name: "Return Policy", version: "v3.1", rule_summary: "30-day return window, exceptions require manager approval", status: "superseded" },
  { policy_id: "return_policy_v3.2", name: "Return Policy", version: "v3.2", rule_summary: "30-day return window, no exceptions", status: "active" },
  { policy_id: "refund_policy_v2.1", name: "Refund Policy", version: "v2.1", rule_summary: "7-day processing, original payment method", status: "active" },
  { policy_id: "cod_policy_v4.0", name: "COD Policy", version: "v4.0", rule_summary: "Available for orders under Rs.15,000", status: "active" },
];

const USERS = [
  { name: "Priya Mehta", tier: "Gold", city: "Bangalore", ltv: 120000, phone: "9876543210", email: "priya@testmail.com" },
  { name: "Rahul Sharma", tier: "Gold", city: "Mumbai", ltv: 95000, phone: "9876543211", email: "rahul@testmail.com" },
  { name: "Sneha Iyer", tier: "Platinum", city: "Bangalore", ltv: 250000, phone: "9876543212", email: "sneha@testmail.com" },
  { name: "Arjun Patel", tier: "Silver", city: "Delhi", ltv: 45000, phone: "9876543213", email: "arjun@testmail.com" },
  { name: "Meera Krishnan", tier: "Gold", city: "Chennai", ltv: 110000, phone: "9876543214", email: "meera@testmail.com" },
  { name: "Vikram Singh", tier: "Bronze", city: "Hyderabad", ltv: 15000, phone: "9876543215", email: "vikram.s@testmail.com" },
  { name: "Kavita Reddy", tier: "Platinum", city: "Bangalore", ltv: 320000, phone: "9876543216", email: "kavita@testmail.com" },
  { name: "Amit Kumar", tier: "Silver", city: "Mumbai", ltv: 38000, phone: "9123456789", email: "amit@testmail.com" },
  { name: "Neha Gupta", tier: "Gold", city: "Delhi", ltv: 87000, phone: "9876543218", email: "neha@testmail.com" },
  { name: "Suresh Nair", tier: "Bronze", city: "Chennai", ltv: 12000, phone: "9876543219", email: "suresh@testmail.com" },
  { name: "Deepika Joshi", tier: "Silver", city: "Bangalore", ltv: 52000, phone: "9876543220", email: "deepika@testmail.com" },
  { name: "Rohit Verma", tier: "Gold", city: "Mumbai", ltv: 105000, phone: "9876543221", email: "rohit@testmail.com" },
  { name: "Anjali Das", tier: "Platinum", city: "Delhi", ltv: 280000, phone: "9876543222", email: "anjali@testmail.com" },
  { name: "Karthik Menon", tier: "Bronze", city: "Chennai", ltv: 18000, phone: "9876543223", email: "karthik@testmail.com" },
  { name: "Pooja Agarwal", tier: "Silver", city: "Hyderabad", ltv: 42000, phone: "9876543224", email: "pooja@testmail.com" },
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function days(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export async function seedRetail(tenantId: string): Promise<{ profiles: number; events: number }> {
  let eventCount = 0;

  // Create products
  for (const p of PRODUCTS) {
    await runQuery(
      `MERGE (p:Product {product_id: $pid, _tenant: $t})
       ON CREATE SET p.name = $name, p.category = $cat, p.brand = $brand, p.price = $price`,
      { pid: p.product_id, t: tenantId, name: p.name, cat: p.category, brand: p.brand, price: p.price }
    );
  }

  // Create agents
  for (const a of AGENTS) {
    await runQuery(
      `MERGE (a:Agent {agent_id: $aid, _tenant: $t})
       ON CREATE SET a.name = $name, a.role = $role, a.team = $team`,
      { aid: a.agent_id, t: tenantId, name: a.name, role: a.role, team: a.team }
    );
  }

  // Create policies + SUPERSEDED_BY
  for (const pol of POLICIES) {
    await runQuery(
      `MERGE (p:Policy {policy_id: $pid, _tenant: $t})
       ON CREATE SET p.name = $name, p.version = $ver, p.rule_summary = $rule, p.status = $status`,
      { pid: pol.policy_id, t: tenantId, name: pol.name, ver: pol.version, rule: pol.rule_summary, status: pol.status }
    );
  }
  await runQuery(
    `MATCH (old:Policy {policy_id: 'return_policy_v3.1', _tenant: $t})
     MATCH (new:Policy {policy_id: 'return_policy_v3.2', _tenant: $t})
     MERGE (old)-[:SUPERSEDED_BY]->(new)`,
    { t: tenantId }
  );

  // Create profiles + identities + journeys
  for (let i = 0; i < USERS.length; i++) {
    const u = USERS[i];
    const profileId = `prof_retail_${String(i + 1).padStart(3, "0")}`;

    // Profile
    await runQuery(
      `CREATE (p:Profile {
        profile_id: $pid, name: $name, tier: $tier, city: $city, ltv: $ltv,
        _tenant: $t, _vertical: 'retail', created_at: datetime()
      })`,
      { pid: profileId, name: u.name, tier: u.tier, city: u.city, ltv: u.ltv, t: tenantId }
    );

    // Identities
    await runQuery(
      `MATCH (p:Profile {profile_id: $pid, _tenant: $t})
       CREATE (i1:Identity {identity_id: $iid1, type: 'email', value: $email, source: 'app_sdk', strength: 'strong', verified: true, first_seen: datetime(), _tenant: $t})
       CREATE (i2:Identity {identity_id: $iid2, type: 'phone', value: $phone, source: 'crm', strength: 'strong', verified: true, first_seen: datetime(), _tenant: $t})
       CREATE (p)-[:HAS_IDENTITY]->(i1)
       CREATE (p)-[:HAS_IDENTITY]->(i2)`,
      { pid: profileId, t: tenantId, email: u.email, phone: u.phone, iid1: `ident_${uuidv4().slice(0, 8)}`, iid2: `ident_${uuidv4().slice(0, 8)}` }
    );

    // Generate journey based on pattern
    const pattern = i % 4; // 0=happy, 1=cart abandon, 2=return+refund, 3=support escalation
    const product = PRODUCTS[i % PRODUCTS.length];
    const agent = AGENTS[i % AGENTS.length];
    pick(PAYMENT_METHODS); // Payment node creation deferred
    let prevEventId: string | null = null;

    const events: { type: string; daysAgo: number; status: string; amount?: number; confidence: number; exception?: boolean }[] = [];

    // All journeys start with browse
    events.push({ type: "page_view", daysAgo: 30 + i, status: "completed", confidence: 1.0 });
    events.push({ type: "product_view", daysAgo: 29 + i, status: "completed", confidence: 1.0 });

    if (pattern === 0) {
      // Happy path
      events.push({ type: "add_to_cart", daysAgo: 28 + i, status: "completed", confidence: 1.0 });
      events.push({ type: "purchase", daysAgo: 27 + i, status: "completed", amount: product.price, confidence: 1.0 });
      events.push({ type: "delivery_completed", daysAgo: 22 + i, status: "completed", confidence: 1.0 });
      events.push({ type: "review_submitted", daysAgo: 20 + i, status: "completed", confidence: 0.95 });
    } else if (pattern === 1) {
      // Cart abandonment
      events.push({ type: "add_to_cart", daysAgo: 28 + i, status: "completed", confidence: 1.0 });
      events.push({ type: "remove_from_cart", daysAgo: 27 + i, status: "completed", confidence: 1.0 });
      events.push({ type: "page_view", daysAgo: 20 + i, status: "completed", confidence: 1.0 });
      events.push({ type: "add_to_cart", daysAgo: 15 + i, status: "completed", confidence: 1.0 });
    } else if (pattern === 2) {
      // Return + refund (with policy exception for Gold/Platinum)
      events.push({ type: "add_to_cart", daysAgo: 40 + i, status: "completed", confidence: 1.0 });
      events.push({ type: "purchase", daysAgo: 39 + i, status: "completed", amount: product.price, confidence: 1.0 });
      events.push({ type: "delivery_completed", daysAgo: 35 + i, status: "completed", confidence: 1.0 });
      const isException = ["Gold", "Platinum"].includes(u.tier);
      events.push({
        type: "return_initiated",
        daysAgo: 3 + i,
        status: isException ? "exception" : "completed",
        amount: product.price,
        confidence: 0.87,
        exception: isException,
      });
      events.push({ type: "refund_issued", daysAgo: 1 + i, status: "pending", amount: product.price, confidence: 0.92 });
    } else {
      // Support escalation
      events.push({ type: "purchase", daysAgo: 25 + i, status: "completed", amount: product.price, confidence: 1.0 });
      events.push({ type: "delivery_completed", daysAgo: 20 + i, status: "completed", confidence: 1.0 });
      events.push({ type: "support_ticket", daysAgo: 10 + i, status: "completed", confidence: 0.88 });
      events.push({ type: "support_ticket", daysAgo: 5 + i, status: "completed", confidence: 0.91 });
      events.push({ type: "return_initiated", daysAgo: 3 + i, status: "completed", amount: product.price, confidence: 0.85 });
    }

    // Write events to Neo4j
    for (const evt of events) {
      const eventId = `evt_${uuidv4().slice(0, 8)}`;

      await runQuery(
        `MATCH (p:Profile {profile_id: $pid, _tenant: $t})
         CREATE (e:Event {
           id: $eid, event_type: $type, timestamp: datetime($ts),
           status: $status, amount: $amount, channel: 'app',
           confidence_score: $confidence, exception: $exception,
           properties: $props, _tenant: $t, created_at: datetime()
         })
         CREATE (p)-[:PERFORMED]->(e)`,
        {
          pid: profileId, t: tenantId, eid: eventId, type: evt.type,
          ts: days(evt.daysAgo), status: evt.status,
          amount: evt.amount || null, confidence: evt.confidence,
          exception: evt.exception || false,
          props: JSON.stringify({ reason: evt.exception ? "size_runs_small" : null }),
        }
      );

      // Link NEXT chain
      if (prevEventId) {
        await runQuery(
          `MATCH (prev:Event {id: $prev, _tenant: $t})
           MATCH (curr:Event {id: $curr, _tenant: $t})
           CREATE (prev)-[:NEXT]->(curr)`,
          { prev: prevEventId, curr: eventId, t: tenantId }
        );
      }
      prevEventId = eventId;

      // Link product for relevant events
      if (["product_view", "add_to_cart", "purchase", "return_initiated"].includes(evt.type)) {
        await runQuery(
          `MATCH (e:Event {id: $eid, _tenant: $t})
           MATCH (prod:Product {product_id: $prodId, _tenant: $t})
           MERGE (e)-[:INVOLVES]->(prod)`,
          { eid: eventId, t: tenantId, prodId: product.product_id }
        );
      }

      // Link policy for return events
      if (evt.type === "return_initiated") {
        const polId = i < 3 ? "return_policy_v3.1" : "return_policy_v3.2"; // some linked to old policy
        const rel = evt.exception ? "OVERRODE" : "GOVERNED_BY";
        await runQuery(
          `MATCH (e:Event {id: $eid, _tenant: $t})
           MATCH (pol:Policy {policy_id: $polId, _tenant: $t})
           CREATE (e)-[:${rel}]->(pol)`,
          { eid: eventId, t: tenantId, polId }
        );

        // Link agent
        await runQuery(
          `MATCH (e:Event {id: $eid, _tenant: $t})
           MATCH (a:Agent {agent_id: $aid, _tenant: $t})
           CREATE (e)-[:HANDLED_BY]->(a)`,
          { eid: eventId, t: tenantId, aid: agent.agent_id }
        );
      }

      // Create commitment for refund events
      if (evt.type === "refund_issued") {
        const commitId = `commit_${uuidv4().slice(0, 8)}`;
        const deadline = new Date();
        deadline.setDate(deadline.getDate() - (evt.daysAgo - 2));
        const breached = evt.daysAgo < 2;
        await runQuery(
          `MATCH (p:Profile {profile_id: $pid, _tenant: $t})
           MATCH (e:Event {id: $eid, _tenant: $t})
           CREATE (c:Commitment {
             commitment_id: $cid, promise_text: 'Refund within 48 hours',
             deadline: datetime($deadline), status: $status,
             assignee: $assignee, confidence_score: 0.92, _tenant: $t, created_at: datetime()
           })
           CREATE (p)-[:HAS_COMMITMENT]->(c)
           CREATE (e)-[:CREATED_COMMITMENT]->(c)`,
          {
            pid: profileId, t: tenantId, eid: eventId, cid: commitId,
            deadline: deadline.toISOString(),
            status: breached ? "open" : "breached",
            assignee: agent.name,
          }
        );
      }

      eventCount++;
    }
  }

  // Duplicate remaining profiles to reach ~50
  for (let i = USERS.length; i < 50; i++) {
    const base = USERS[i % USERS.length];
    const profileId = `prof_retail_${String(i + 1).padStart(3, "0")}`;
    const city = pick(CITIES);
    const tier = pick(TIERS);

    await runQuery(
      `CREATE (p:Profile {
        profile_id: $pid, name: $name, tier: $tier, city: $city, ltv: $ltv,
        _tenant: $t, _vertical: 'retail', created_at: datetime()
      })`,
      { pid: profileId, name: `${base.name.split(" ")[0]} ${String.fromCharCode(65 + i)}`, tier, city, ltv: Math.floor(Math.random() * 200000), t: tenantId }
    );

    // Add 2-3 basic events
    const product = pick(PRODUCTS);
    for (const type of ["page_view", "product_view", "purchase"]) {
      const eid = `evt_${uuidv4().slice(0, 8)}`;
      await runQuery(
        `MATCH (p:Profile {profile_id: $pid, _tenant: $t})
         CREATE (e:Event {id: $eid, event_type: $type, timestamp: datetime($ts), status: 'completed', confidence_score: 1.0, _tenant: $t, created_at: datetime()})
         CREATE (p)-[:PERFORMED]->(e)`,
        { pid: profileId, t: tenantId, eid, type, ts: days(Math.floor(Math.random() * 30)) }
      );
      if (type === "purchase") {
        await runQuery(
          `MATCH (e:Event {id: $eid, _tenant: $t}) MATCH (prod:Product {product_id: $prodId, _tenant: $t}) MERGE (e)-[:INVOLVES]->(prod)`,
          { eid, t: tenantId, prodId: product.product_id }
        );
      }
      eventCount++;
    }
  }

  return { profiles: 50, events: eventCount };
}
