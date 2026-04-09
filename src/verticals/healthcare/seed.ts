import { runQuery } from "@/lib/neo4j";
import { v4 as uuidv4 } from "uuid";

const DEPARTMENTS = [
  { department_id: "dept_cardio", name: "Cardiology", type: "Clinical", capacity: 40 },
  { department_id: "dept_ortho", name: "Orthopedics", type: "Surgical", capacity: 30 },
  { department_id: "dept_genmed", name: "General Medicine", type: "Clinical", capacity: 50 },
  { department_id: "dept_er", name: "Emergency", type: "Emergency", capacity: 25 },
  { department_id: "dept_neuro", name: "Neurology", type: "Clinical", capacity: 20 },
];

const PROVIDERS = [
  { provider_id: "dr_sharma_001", name: "Dr. Sharma", specialization: "Cardiologist", department: "Cardiology", experience_years: 15 },
  { provider_id: "dr_patel_001", name: "Dr. Patel", specialization: "Cardiologist", department: "Cardiology", experience_years: 10 },
  { provider_id: "dr_iyer_001", name: "Dr. Iyer", specialization: "Orthopedic Surgeon", department: "Orthopedics", experience_years: 12 },
  { provider_id: "dr_mehta_001", name: "Dr. Mehta", specialization: "Orthopedic Surgeon", department: "Orthopedics", experience_years: 8 },
  { provider_id: "dr_reddy_001", name: "Dr. Reddy", specialization: "General Physician", department: "General Medicine", experience_years: 20 },
  { provider_id: "dr_nair_001", name: "Dr. Nair", specialization: "Neurologist", department: "Neurology", experience_years: 14 },
  { provider_id: "dr_gupta_001", name: "Dr. Gupta", specialization: "Emergency Medicine", department: "Emergency", experience_years: 7 },
];

const PROTOCOLS = [
  { protocol_id: "proto_stemi_v1.0", name: "Acute MI Protocol", version: "v1.0", condition: "STEMI", standard_treatment: "Thrombolysis within 60 min", status: "superseded" },
  { protocol_id: "proto_stemi_v2.1", name: "Acute MI Protocol", version: "v2.1", condition: "STEMI", standard_treatment: "Primary PCI within 90 min + 2-week follow-up angiogram", status: "active" },
  { protocol_id: "proto_fracture_v1.0", name: "Fracture Management", version: "v1.0", condition: "Fracture", standard_treatment: "Immobilization + surgical consultation", status: "active" },
  { protocol_id: "proto_diabetes_v2.0", name: "Diabetes Management", version: "v2.0", condition: "Type 2 Diabetes", standard_treatment: "Metformin first-line, dose escalation before insulin", status: "active" },
];

const PATIENTS = [
  { name: "Amit Kumar", age: 58, gender: "Male", blood_group: "B+", city: "Mumbai", insurance: "Star Health", phone: "9123456789", email: "amit@testmail.com", mrn: "MH-4829" },
  { name: "Suresh Reddy", age: 62, gender: "Male", blood_group: "O+", city: "Hyderabad", insurance: "ICICI Lombard", phone: "9123456790", email: "suresh.r@testmail.com", mrn: "MH-4830" },
  { name: "Kavita Patel", age: 45, gender: "Female", blood_group: "A+", city: "Mumbai", insurance: "Star Health", phone: "9988776655", email: "kavita@testmail.com", mrn: "MH-4831" },
  { name: "Rajan Nair", age: 55, gender: "Male", blood_group: "AB+", city: "Chennai", insurance: "HDFC Ergo", phone: "9123456792", email: "rajan@testmail.com", mrn: "MH-4832" },
  { name: "Priya Krishnan", age: 38, gender: "Female", blood_group: "B-", city: "Bangalore", insurance: "Star Health", phone: "9123456793", email: "priya.k@testmail.com", mrn: "MH-4833" },
  { name: "Deepak Joshi", age: 70, gender: "Male", blood_group: "O-", city: "Delhi", insurance: "National Insurance", phone: "9123456794", email: "deepak.j@testmail.com", mrn: "MH-4834" },
  { name: "Neha Sharma", age: 42, gender: "Female", blood_group: "A-", city: "Mumbai", insurance: "ICICI Lombard", phone: "9001122334", email: "neha@testmail.com", mrn: "MH-4835" },
  { name: "Rajesh Gupta", age: 65, gender: "Male", blood_group: "B+", city: "Delhi", insurance: "Star Health", phone: "9123456796", email: "rajesh.g@testmail.com", mrn: "MH-4836" },
  { name: "Anita Das", age: 50, gender: "Female", blood_group: "O+", city: "Chennai", insurance: "New India Assurance", phone: "9123456797", email: "anita.d@testmail.com", mrn: "MH-4837" },
  { name: "Mohan Singh", age: 48, gender: "Male", blood_group: "AB-", city: "Hyderabad", insurance: "HDFC Ergo", phone: "9123456798", email: "mohan@testmail.com", mrn: "MH-4838" },
  { name: "Sunita Rao", age: 55, gender: "Female", blood_group: "A+", city: "Bangalore", insurance: "Star Health", phone: "9123456799", email: "sunita@testmail.com", mrn: "MH-4839" },
  { name: "Vijay Menon", age: 60, gender: "Male", blood_group: "B+", city: "Mumbai", insurance: "ICICI Lombard", phone: "9123456800", email: "vijay.m@testmail.com", mrn: "MH-4840" },
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function days(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export async function seedHealthcare(tenantId: string): Promise<{ profiles: number; events: number }> {
  let eventCount = 0;

  // Create departments
  for (const dept of DEPARTMENTS) {
    await runQuery(
      `MERGE (d:Department {department_id: $did, _tenant: $t})
       ON CREATE SET d.name = $name, d.type = $type, d.capacity = $cap`,
      { did: dept.department_id, t: tenantId, name: dept.name, type: dept.type, cap: dept.capacity }
    );
  }

  // Create providers + link to departments
  for (const pr of PROVIDERS) {
    await runQuery(
      `MERGE (pr:Provider {provider_id: $prid, _tenant: $t})
       ON CREATE SET pr.name = $name, pr.specialization = $spec, pr.department = $dept, pr.experience_years = $exp
       WITH pr
       MATCH (d:Department {name: $dept, _tenant: $t})
       MERGE (pr)-[:BELONGS_TO]->(d)`,
      { prid: pr.provider_id, t: tenantId, name: pr.name, spec: pr.specialization, dept: pr.department, exp: pr.experience_years }
    );
  }

  // Create protocols + SUPERSEDED_BY
  for (const proto of PROTOCOLS) {
    await runQuery(
      `MERGE (pt:Protocol {protocol_id: $ptid, _tenant: $t})
       ON CREATE SET pt.name = $name, pt.version = $ver, pt.condition = $cond, pt.standard_treatment = $treat, pt.status = $status`,
      { ptid: proto.protocol_id, t: tenantId, name: proto.name, ver: proto.version, cond: proto.condition, treat: proto.standard_treatment, status: proto.status }
    );
  }
  await runQuery(
    `MATCH (old:Protocol {protocol_id: 'proto_stemi_v1.0', _tenant: $t})
     MATCH (new:Protocol {protocol_id: 'proto_stemi_v2.1', _tenant: $t})
     MERGE (old)-[:SUPERSEDED_BY]->(new)`,
    { t: tenantId }
  );

  // Create patient profiles + journeys
  for (let i = 0; i < PATIENTS.length; i++) {
    const pt = PATIENTS[i];
    const profileId = `prof_hc_${String(i + 1).padStart(3, "0")}`;
    const pattern = i % 4; // 0=standard, 1=readmission, 2=chronic, 3=insurance denied

    // Profile
    await runQuery(
      `CREATE (p:Profile {
        profile_id: $pid, name: $name, age: $age, gender: $gender,
        blood_group: $bg, city: $city, insurance_provider: $ins,
        _tenant: $t, _vertical: 'healthcare', created_at: datetime()
      })`,
      { pid: profileId, name: pt.name, age: pt.age, gender: pt.gender, bg: pt.blood_group, city: pt.city, ins: pt.insurance, t: tenantId }
    );

    // Identities
    await runQuery(
      `MATCH (p:Profile {profile_id: $pid, _tenant: $t})
       CREATE (i1:Identity {identity_id: $iid1, type: 'mrn', value: $mrn, source: 'hospital_ehr', strength: 'strong', verified: true, first_seen: datetime(), _tenant: $t})
       CREATE (i2:Identity {identity_id: $iid2, type: 'phone', value: $phone, source: 'registration', strength: 'strong', verified: true, first_seen: datetime(), _tenant: $t})
       CREATE (i3:Identity {identity_id: $iid3, type: 'email', value: $email, source: 'registration', strength: 'strong', verified: true, first_seen: datetime(), _tenant: $t})
       CREATE (p)-[:HAS_IDENTITY]->(i1)
       CREATE (p)-[:HAS_IDENTITY]->(i2)
       CREATE (p)-[:HAS_IDENTITY]->(i3)`,
      { pid: profileId, t: tenantId, mrn: pt.mrn, phone: pt.phone, email: pt.email,
        iid1: `ident_${uuidv4().slice(0, 8)}`, iid2: `ident_${uuidv4().slice(0, 8)}`, iid3: `ident_${uuidv4().slice(0, 8)}` }
    );

    const provider = PROVIDERS[i % PROVIDERS.length];
    let prevVisitId: string | null = null;

    if (pattern === 0) {
      // Standard visit: ER → Diagnosis → Treatment → Discharge → Follow-up
      const visits = [
        { type: "Emergency", dept: "Cardiology", priority: "High", daysAgo: 25, confidence: 0.95, diagName: "Unstable Angina", icd: "I20.0", severity: "Severe", treatName: "Medical Management", treatType: "Therapy", cost: 45000, claimStatus: "Approved" },
        { type: "Follow-up", dept: "Cardiology", priority: "Medium", daysAgo: 10, confidence: 0.92, diagName: null, icd: null, severity: null, treatName: null, treatType: null, cost: 0, claimStatus: null },
      ];
      for (const v of visits) {
        const vid = `visit_${uuidv4().slice(0, 8)}`;
        await createVisit(vid, profileId, v, provider, tenantId, prevVisitId);
        prevVisitId = vid;
        eventCount++;
      }
    } else if (pattern === 1) {
      // Readmission pattern (STEMI → PCI → Discharge → Readmission)
      const isDeviation = provider.provider_id === "dr_sharma_001"; // Dr. Sharma deviates from protocol
      const v1 = { type: "Emergency", dept: "Cardiology", priority: "Critical", daysAgo: 30, confidence: 0.95, diagName: "Acute MI (STEMI)", icd: "I21.0", severity: "Critical", treatName: "Primary PCI / Angioplasty", treatType: "Procedure", cost: 250000, claimStatus: "Pending" };
      const v2 = { type: "Inpatient", dept: "Cardiology", priority: "High", daysAgo: 25, confidence: 0.91, diagName: null, icd: null, severity: null, treatName: null, treatType: null, cost: 0, claimStatus: null };
      const v3 = { type: "Emergency", dept: "Cardiology", priority: "Critical", daysAgo: 12, confidence: 0.88, diagName: "Post-PCI Restenosis", icd: "T82.855", severity: "Severe", treatName: "Repeat Angioplasty", treatType: "Procedure", cost: 200000, claimStatus: "Pending" };

      for (const v of [v1, v2, v3]) {
        const vid = `visit_${uuidv4().slice(0, 8)}`;
        await createVisit(vid, profileId, v, provider, tenantId, prevVisitId, v === v1 ? isDeviation : false);
        prevVisitId = vid;
        eventCount++;
      }

      // Readmission edge
      await runQuery(
        `MATCH (p:Profile {profile_id: $pid, _tenant: $t})-[:HAD_VISIT]->(v:Visit)
         WHERE v.type = 'Emergency' AND v.timestamp >= datetime($ts)
         WITH p, v ORDER BY v.timestamp DESC LIMIT 1
         CREATE (p)-[:READMITTED {days_gap: 18}]->(v)`,
        { pid: profileId, t: tenantId, ts: days(15) }
      );

      // Outcome with readmission
      await runQuery(
        `MATCH (p:Profile {profile_id: $pid, _tenant: $t})-[:HAD_VISIT]->(v:Visit)
         WHERE v.type = 'Emergency'
         WITH v ORDER BY v.timestamp ASC LIMIT 1
         CREATE (o:Outcome {outcome_id: $oid, type: 'Improved', readmission: true, days_to_readmission: 18, follow_up_scheduled: false, _tenant: $t})
         CREATE (v)-[:RESULTED_IN]->(o)`,
        { pid: profileId, t: tenantId, oid: `out_${uuidv4().slice(0, 8)}` }
      );

      // Missed follow-up commitment
      const commitDeadline = new Date();
      commitDeadline.setDate(commitDeadline.getDate() - 16);
      await runQuery(
        `MATCH (p:Profile {profile_id: $pid, _tenant: $t})
         CREATE (c:Commitment {commitment_id: $cid, promise_text: 'Follow-up angiogram in 2 weeks', deadline: datetime($deadline), status: 'breached', assignee: $assignee, confidence_score: 0.94, _tenant: $t, created_at: datetime(), breached_at: datetime()})
         CREATE (p)-[:HAS_COMMITMENT]->(c)`,
        { pid: profileId, t: tenantId, cid: `commit_${uuidv4().slice(0, 8)}`, deadline: commitDeadline.toISOString(), assignee: provider.name }
      );
    } else if (pattern === 2) {
      // Chronic management (diabetes → metformin → ER → insulin switch)
      const visits = [
        { type: "Outpatient", dept: "General Medicine", priority: "Medium", daysAgo: 60, confidence: 0.93, diagName: "Type 2 Diabetes", icd: "E11", severity: "Moderate", treatName: "Metformin 500mg", treatType: "Therapy", cost: 2000, claimStatus: "Approved" },
        { type: "Follow-up", dept: "General Medicine", priority: "Low", daysAgo: 30, confidence: 0.90, diagName: null, icd: null, severity: null, treatName: null, treatType: null, cost: 500, claimStatus: null },
        { type: "Emergency", dept: "Emergency", priority: "High", daysAgo: 10, confidence: 0.87, diagName: "Diabetic Ketoacidosis", icd: "E11.10", severity: "Severe", treatName: "Insulin Therapy", treatType: "Therapy", cost: 35000, claimStatus: "Approved" },
      ];
      for (const v of visits) {
        const vid = `visit_${uuidv4().slice(0, 8)}`;
        // Protocol deviation on the last visit (switched to insulin without dose increase)
        const deviation = v === visits[2];
        await createVisit(vid, profileId, v, deviation ? PROVIDERS.find(p => p.provider_id === "dr_reddy_001")! : provider, tenantId, prevVisitId, deviation);
        prevVisitId = vid;
        eventCount++;
      }
    } else {
      // Insurance denied (knee replacement)
      const v1 = { type: "Outpatient", dept: "Orthopedics", priority: "Medium", daysAgo: 40, confidence: 0.96, diagName: "Knee Osteoarthritis", icd: "M17.1", severity: "Severe", treatName: "Total Knee Replacement", treatType: "Surgery", cost: 350000, claimStatus: "Denied" };
      const vid = `visit_${uuidv4().slice(0, 8)}`;
      await createVisit(vid, profileId, v1, PROVIDERS.find(p => p.provider_id === "dr_mehta_001")!, tenantId, prevVisitId);
      prevVisitId = vid;
      eventCount++;

      // Denied claim with reason
      await runQuery(
        `MATCH (v:Visit {visit_id: $vid, _tenant: $t})-[:CLAIMED_VIA]->(ic:InsuranceClaim)
         SET ic.denial_reason = 'Pre-authorization not filed'`,
        { vid, t: tenantId }
      );
    }
  }

  // Fill remaining to ~50 with simpler profiles
  for (let i = PATIENTS.length; i < 50; i++) {
    const profileId = `prof_hc_${String(i + 1).padStart(3, "0")}`;
    const gender = i % 2 === 0 ? "Male" : "Female";
    const city = pick(["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad"]);

    await runQuery(
      `CREATE (p:Profile {
        profile_id: $pid, name: $name, age: $age, gender: $gender,
        blood_group: 'O+', city: $city, insurance_provider: 'Star Health',
        _tenant: $t, _vertical: 'healthcare', created_at: datetime()
      })`,
      { pid: profileId, name: `Patient ${String.fromCharCode(65 + (i % 26))}${i}`, age: 30 + (i % 40), gender, city, t: tenantId }
    );

    const vid = `visit_${uuidv4().slice(0, 8)}`;
    const dept = pick(DEPARTMENTS);
    await runQuery(
      `MATCH (p:Profile {profile_id: $pid, _tenant: $t})
       CREATE (v:Visit {visit_id: $vid, type: 'Outpatient', timestamp: datetime($ts), department: $dept, status: 'Discharged', priority: 'Low', confidence_score: 1.0, _tenant: $t})
       CREATE (p)-[:HAD_VISIT]->(v)`,
      { pid: profileId, t: tenantId, vid, ts: days(Math.floor(Math.random() * 60)), dept: dept.name }
    );
    eventCount++;
  }

  return { profiles: 50, events: eventCount };
}

async function createVisit(
  visitId: string,
  profileId: string,
  v: { type: string; dept: string; priority: string; daysAgo: number; confidence: number; diagName: string | null; icd: string | null; severity: string | null; treatName: string | null; treatType: string | null; cost: number; claimStatus: string | null },
  provider: typeof PROVIDERS[0],
  tenantId: string,
  prevVisitId: string | null,
  protocolDeviation: boolean = false
): Promise<void> {
  // Create visit
  await runQuery(
    `MATCH (p:Profile {profile_id: $pid, _tenant: $t})
     CREATE (v:Visit {visit_id: $vid, type: $type, timestamp: datetime($ts), department: $dept, status: 'Discharged', priority: $pri, confidence_score: $conf, duration_hours: $dur, _tenant: $t})
     CREATE (p)-[:HAD_VISIT]->(v)`,
    { pid: profileId, t: tenantId, vid: visitId, type: v.type, ts: days(v.daysAgo), dept: v.dept, pri: v.priority, conf: v.confidence, dur: Math.floor(Math.random() * 24) + 1 }
  );

  // Link NEXT
  if (prevVisitId) {
    await runQuery(
      `MATCH (prev:Visit {visit_id: $prev, _tenant: $t}) MATCH (curr:Visit {visit_id: $curr, _tenant: $t}) CREATE (prev)-[:NEXT]->(curr)`,
      { prev: prevVisitId, curr: visitId, t: tenantId }
    );
  }

  // Diagnosis
  if (v.diagName) {
    const diagId = `diag_${uuidv4().slice(0, 8)}`;
    await runQuery(
      `MATCH (vis:Visit {visit_id: $vid, _tenant: $t})
       MERGE (d:Diagnosis {name: $name, _tenant: $t})
       ON CREATE SET d.diagnosis_id = $did, d.icd_code = $icd, d.severity = $sev, d.chronic = false
       CREATE (vis)-[:DIAGNOSED_WITH]->(d)`,
      { vid: visitId, t: tenantId, did: diagId, name: v.diagName, icd: v.icd, sev: v.severity }
    );
  }

  // Treatment
  if (v.treatName) {
    const treatId = `treat_${uuidv4().slice(0, 8)}`;
    await runQuery(
      `MATCH (vis:Visit {visit_id: $vid, _tenant: $t})
       CREATE (tr:Treatment {treatment_id: $tid, name: $name, type: $type, cost: $cost, _tenant: $t})
       CREATE (vis)-[:TREATED_WITH]->(tr)`,
      { vid: visitId, t: tenantId, tid: treatId, name: v.treatName, type: v.treatType, cost: v.cost }
    );
  }

  // Provider
  await runQuery(
    `MATCH (vis:Visit {visit_id: $vid, _tenant: $t})
     MATCH (pr:Provider {provider_id: $prid, _tenant: $t})
     CREATE (vis)-[:ATTENDED_BY]->(pr)`,
    { vid: visitId, t: tenantId, prid: provider.provider_id }
  );

  // Department
  await runQuery(
    `MATCH (vis:Visit {visit_id: $vid, _tenant: $t})
     MATCH (d:Department {name: $dept, _tenant: $t})
     CREATE (vis)-[:IN_DEPARTMENT]->(d)`,
    { vid: visitId, t: tenantId, dept: v.dept }
  );

  // Protocol (governed or deviated)
  if (v.diagName?.includes("MI") || v.diagName?.includes("STEMI")) {
    const protoId = protocolDeviation ? "proto_stemi_v2.1" : "proto_stemi_v2.1";
    const rel = protocolDeviation ? "DEVIATED_FROM" : "GOVERNED_BY";
    await runQuery(
      `MATCH (vis:Visit {visit_id: $vid, _tenant: $t})
       MATCH (pt:Protocol {protocol_id: $ptid, _tenant: $t})
       CREATE (vis)-[:${rel}]->(pt)`,
      { vid: visitId, t: tenantId, ptid: protoId }
    );
  }

  // Insurance claim
  if (v.claimStatus) {
    const claimId = `clm_${uuidv4().slice(0, 8)}`;
    await runQuery(
      `MATCH (vis:Visit {visit_id: $vid, _tenant: $t})
       CREATE (ic:InsuranceClaim {claim_id: $cid, amount: $amount, status: $status, payer: 'Star Health', _tenant: $t})
       CREATE (vis)-[:CLAIMED_VIA]->(ic)`,
      { vid: visitId, t: tenantId, cid: claimId, amount: v.cost, status: v.claimStatus }
    );
  }
}
