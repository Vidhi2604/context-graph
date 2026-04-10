import { runQuery } from "@/lib/neo4j";
import { v4 as uuidv4 } from "uuid";

const CITIES = ["Mumbai","Delhi","Bangalore","Chennai","Hyderabad","Pune","Kolkata","Ahmedabad","Jaipur","Lucknow","Bhopal","Nagpur"];
const BLOOD_GROUPS = ["A+","A-","B+","B-","O+","O-","AB+","AB-"];
const INSURERS = ["Star Health","ICICI Lombard","HDFC Ergo","New India Assurance","National Insurance","Bajaj Allianz","United India","Max Bupa","Reliance Health","Care Health"];

const DEPARTMENTS = [
  {id:"dept_cardio",name:"Cardiology",type:"Clinical",capacity:40},
  {id:"dept_ortho",name:"Orthopedics",type:"Surgical",capacity:30},
  {id:"dept_genmed",name:"General Medicine",type:"Clinical",capacity:50},
  {id:"dept_er",name:"Emergency",type:"Emergency",capacity:25},
  {id:"dept_neuro",name:"Neurology",type:"Clinical",capacity:20},
  {id:"dept_pulmo",name:"Pulmonology",type:"Clinical",capacity:20},
  {id:"dept_nephro",name:"Nephrology",type:"Clinical",capacity:15},
  {id:"dept_gastro",name:"Gastroenterology",type:"Clinical",capacity:20},
];

const PROVIDERS = [
  {id:"dr_sharma",name:"Dr. Sharma",spec:"Cardiologist",dept:"Cardiology",exp:15},
  {id:"dr_patel",name:"Dr. Patel",spec:"Cardiologist",dept:"Cardiology",exp:10},
  {id:"dr_iyer",name:"Dr. Iyer",spec:"Orthopedic Surgeon",dept:"Orthopedics",exp:12},
  {id:"dr_mehta",name:"Dr. Mehta",spec:"Orthopedic Surgeon",dept:"Orthopedics",exp:8},
  {id:"dr_reddy",name:"Dr. Reddy",spec:"General Physician",dept:"General Medicine",exp:20},
  {id:"dr_nair",name:"Dr. Nair",spec:"Neurologist",dept:"Neurology",exp:14},
  {id:"dr_gupta",name:"Dr. Gupta",spec:"Emergency Medicine",dept:"Emergency",exp:7},
  {id:"dr_singh",name:"Dr. Singh",spec:"Pulmonologist",dept:"Pulmonology",exp:11},
  {id:"dr_rao",name:"Dr. Rao",spec:"Nephrologist",dept:"Nephrology",exp:16},
  {id:"dr_joshi",name:"Dr. Joshi",spec:"Gastroenterologist",dept:"Gastroenterology",exp:9},
  {id:"dr_krishna",name:"Dr. Krishna",spec:"General Physician",dept:"General Medicine",exp:22},
  {id:"dr_agarwal",name:"Dr. Agarwal",spec:"Cardiologist",dept:"Cardiology",exp:18},
];

const PROTOCOLS = [
  {id:"proto_stemi_v1",name:"Acute MI Protocol",ver:"v1.0",cond:"STEMI",treat:"Thrombolysis within 60 min",status:"superseded"},
  {id:"proto_stemi_v2",name:"Acute MI Protocol",ver:"v2.1",cond:"STEMI",treat:"Primary PCI within 90 min + 2-week follow-up",status:"active"},
  {id:"proto_fracture",name:"Fracture Management",ver:"v1.0",cond:"Fracture",treat:"Immobilization + surgical consultation",status:"active"},
  {id:"proto_diabetes",name:"Diabetes Management",ver:"v2.0",cond:"Type 2 Diabetes",treat:"Metformin first-line, dose escalation before insulin",status:"active"},
  {id:"proto_stroke",name:"Stroke Protocol",ver:"v1.2",cond:"Ischemic Stroke",treat:"tPA within 4.5 hours + CT scan within 25 min",status:"active"},
  {id:"proto_pneumonia",name:"Pneumonia Protocol",ver:"v1.0",cond:"Community Acquired Pneumonia",treat:"Antibiotics + O2 therapy if SpO2 < 94%",status:"active"},
  {id:"proto_ckd",name:"CKD Management",ver:"v2.0",cond:"Chronic Kidney Disease",treat:"ACE inhibitor + dietary restrictions + quarterly monitoring",status:"active"},
];

// Clinical entities
const DIAGNOSES = [
  {id:"diag_stemi",icd:"I21.0",name:"Acute MI (STEMI)",sev:"Critical"},
  {id:"diag_nstemi",icd:"I21.4",name:"Acute MI (NSTEMI)",sev:"Severe"},
  {id:"diag_angina",icd:"I20.0",name:"Unstable Angina",sev:"Severe"},
  {id:"diag_hf",icd:"I50.9",name:"Heart Failure",sev:"Severe"},
  {id:"diag_htn",icd:"I10",name:"Hypertension",sev:"Moderate"},
  {id:"diag_fracture_knee",icd:"S82.0",name:"Distal Femur Fracture",sev:"Severe"},
  {id:"diag_oa_knee",icd:"M17.1",name:"Knee Osteoarthritis",sev:"Moderate"},
  {id:"diag_oa_hip",icd:"M16.1",name:"Hip Osteoarthritis",sev:"Moderate"},
  {id:"diag_dm2",icd:"E11",name:"Type 2 Diabetes Mellitus",sev:"Moderate"},
  {id:"diag_dka",icd:"E11.10",name:"Diabetic Ketoacidosis",sev:"Critical"},
  {id:"diag_stroke",icd:"I63.9",name:"Ischemic Stroke",sev:"Critical"},
  {id:"diag_tia",icd:"G45.9",name:"Transient Ischemic Attack",sev:"Severe"},
  {id:"diag_pneumonia",icd:"J18.9",name:"Community Acquired Pneumonia",sev:"Moderate"},
  {id:"diag_copd",icd:"J44.1",name:"COPD Exacerbation",sev:"Severe"},
  {id:"diag_ckd3",icd:"N18.3",name:"CKD Stage 3",sev:"Moderate"},
  {id:"diag_ckd5",icd:"N18.5",name:"CKD Stage 5 (ESRD)",sev:"Critical"},
  {id:"diag_appendicitis",icd:"K37",name:"Acute Appendicitis",sev:"Severe"},
  {id:"diag_gastritis",icd:"K29.7",name:"Chronic Gastritis",sev:"Mild"},
  {id:"diag_migraine",icd:"G43.9",name:"Chronic Migraine",sev:"Moderate"},
  {id:"diag_epilepsy",icd:"G40.9",name:"Epilepsy",sev:"Moderate"},
];

const FIRST = ["Amit","Suresh","Kavita","Rajan","Priya","Deepak","Neha","Mohan","Sunita","Vijay","Anita","Rajesh","Meena","Sanjay","Rekha","Arun","Geeta","Ashok","Usha","Vivek","Lakshmi","Ramesh","Pushpa","Vinod","Sarla","Manoj","Savita","Dinesh","Mamta","Sunil","Asha","Harish","Vandana","Prakash","Kamla","Devesh","Sharda","Mukesh","Radha","Ramesh","Seema","Ajay","Nirmal","Shankar","Parvati","Hemant","Sumitra","Girish","Gita","Rajendra"];
const LAST = ["Kumar","Sharma","Singh","Patel","Reddy","Nair","Iyer","Gupta","Shah","Joshi","Rao","Menon","Desai","Verma","Tiwari","Pandey","Sinha","Yadav","Chauhan","Malhotra","Das","Naik","Kaur","Mehta","Agarwal","Pillai","Bhat","Bose","Chopra","Mishra"];

function pick<T>(a: T[]): T { return a[Math.floor(Math.random()*a.length)]; }
function ri(min: number, max: number) { return Math.floor(Math.random()*(max-min+1))+min; }
function da(n: number) { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString(); }

type PT = "cardiac_simple"|"cardiac_readmit"|"ortho_surgery"|"ortho_denied"|"diabetes_stable"|"diabetes_crisis"|"stroke"|"respiratory"|"renal"|"gi"|"neurology"|"er_only";

function pickJourney(age: number): PT {
  const r = Math.random();
  if (age >= 60) {
    if (r<0.20) return "cardiac_simple";
    if (r<0.35) return "cardiac_readmit";
    if (r<0.48) return "ortho_surgery";
    if (r<0.58) return "diabetes_stable";
    if (r<0.68) return "diabetes_crisis";
    if (r<0.76) return "stroke";
    if (r<0.83) return "renal";
    if (r<0.90) return "respiratory";
    return "er_only";
  }
  if (age >= 40) {
    if (r<0.15) return "cardiac_simple";
    if (r<0.25) return "cardiac_readmit";
    if (r<0.38) return "ortho_surgery";
    if (r<0.48) return "ortho_denied";
    if (r<0.60) return "diabetes_stable";
    if (r<0.70) return "diabetes_crisis";
    if (r<0.78) return "respiratory";
    if (r<0.85) return "gi";
    if (r<0.92) return "er_only";
    return "neurology";
  }
  // Under 40
  if (r<0.12) return "ortho_surgery";
  if (r<0.25) return "gi";
  if (r<0.38) return "neurology";
  if (r<0.52) return "respiratory";
  if (r<0.65) return "er_only";
  if (r<0.78) return "diabetes_stable";
  return "stroke";
}

export async function seedHealthcare(tenantId: string): Promise<{profiles:number;events:number}> {
  let ev = 0; const T = tenantId;

  for (const d of DEPARTMENTS) await runQuery(`MERGE (x:Department {department_id:$id,_tenant:$t}) ON CREATE SET x.name=$n,x.type=$type,x.capacity=$cap`,{id:d.id,t:T,n:d.name,type:d.type,cap:d.capacity});
  for (const p of PROVIDERS) {
    await runQuery(`MERGE (x:Provider {provider_id:$id,_tenant:$t}) ON CREATE SET x.name=$n,x.specialization=$s,x.department=$d,x.experience_years=$e`,{id:p.id,t:T,n:p.name,s:p.spec,d:p.dept,e:p.exp});
    await runQuery(`MATCH (p:Provider {provider_id:$pid,_tenant:$t}) MATCH (d:Department {name:$dept,_tenant:$t}) MERGE (p)-[:BELONGS_TO]->(d)`,{pid:p.id,t:T,dept:p.dept});
  }
  for (const pr of PROTOCOLS) await runQuery(`MERGE (x:Protocol {protocol_id:$id,_tenant:$t}) ON CREATE SET x.name=$n,x.version=$v,x.condition=$c,x.standard_treatment=$tr,x.status=$s`,{id:pr.id,t:T,n:pr.name,v:pr.ver,c:pr.cond,tr:pr.treat,s:pr.status});
  await runQuery(`MATCH (a:Protocol {protocol_id:'proto_stemi_v1',_tenant:$t}) MATCH (b:Protocol {protocol_id:'proto_stemi_v2',_tenant:$t}) MERGE (a)-[:SUPERSEDED_BY]->(b)`,{t:T});

  for (let i = 0; i < 200; i++) {
    const fName = FIRST[i % FIRST.length];
    const lName = LAST[Math.floor(i/FIRST.length) % LAST.length];
    const name = `${fName} ${lName}`;
    const age = ri(18,82);
    const gender = i%2===0?"Male":"Female";
    const city = CITIES[i % CITIES.length];
    const insurer = INSURERS[i % INSURERS.length];
    const blood = pick(BLOOD_GROUPS);
    const pid = `prof_h_${String(i+1).padStart(3,"0")}`;
    const mrn = `MH-${4800+i}`;
    const email = `${fName.toLowerCase()}.${lName.toLowerCase()}.${i}@testmail.com`;
    const phone = `${9100000000+i}`;

    await runQuery(`CREATE (p:Profile {profile_id:$pid,name:$name,age:$age,gender:$gender,blood_group:$bg,city:$city,insurance_provider:$ins,_tenant:$t,_vertical:'healthcare',created_at:datetime()})`,{pid,name,age,gender,bg:blood,city,ins:insurer,t:T});
    await runQuery(
      `MATCH (p:Profile {profile_id:$pid,_tenant:$t})
       CREATE (i1:Identity {identity_id:$id1,type:'mrn',value:$mrn,source:'hospital_ehr',strength:'strong',verified:true,first_seen:datetime(),_tenant:$t})
       CREATE (i2:Identity {identity_id:$id2,type:'phone',value:$phone,source:'registration',strength:'strong',verified:true,first_seen:datetime(),_tenant:$t})
       CREATE (i3:Identity {identity_id:$id3,type:'email',value:$email,source:'registration',strength:'strong',verified:true,first_seen:datetime(),_tenant:$t})
       CREATE (p)-[:HAS_IDENTITY]->(i1) CREATE (p)-[:HAS_IDENTITY]->(i2) CREATE (p)-[:HAS_IDENTITY]->(i3)`,
      {pid,t:T,mrn,phone,email,id1:`id_${uuidv4().slice(0,8)}`,id2:`id_${uuidv4().slice(0,8)}`,id3:`id_${uuidv4().slice(0,8)}`}
    );

    const jt = pickJourney(age);
    const provider = PROVIDERS[i % PROVIDERS.length];
    const off = ri(0,20);

    // Build visit sequence
    type V = {vid:string;type:string;dept:string;priority:string;ago:number;conf:number;diagId?:string;treatName?:string;treatCost?:number;claimAmt?:number;claimStatus?:string;protocolId?:string;deviated?:boolean;outcome?:string;readmit?:boolean;daysToReadmit?:number};
    const visits: V[] = [];

    const makeVid = () => `visit_${uuidv4().slice(0,8)}`;

    if (jt==="cardiac_simple") {
      visits.push({vid:makeVid(),type:"Emergency",dept:"Cardiology",priority:"High",ago:30+off,conf:0.95,diagId:"diag_angina",treatName:"Medical Management",treatCost:45000,claimAmt:45000,claimStatus:"Approved",protocolId:"proto_stemi_v2",outcome:"Improved"});
      visits.push({vid:makeVid(),type:"Follow-up",dept:"Cardiology",priority:"Medium",ago:15+off,conf:0.92,outcome:"Recovered"});
    } else if (jt==="cardiac_readmit") {
      const missedFollowup = Math.random()<0.7;
      visits.push({vid:makeVid(),type:"Emergency",dept:"Cardiology",priority:"Critical",ago:35+off,conf:0.95,diagId:"diag_stemi",treatName:"Primary PCI",treatCost:250000,claimAmt:250000,claimStatus:"Pending",protocolId:"proto_stemi_v2",deviated:missedFollowup,outcome:"Improved",readmit:true,daysToReadmit:ri(15,28)});
      visits.push({vid:makeVid(),type:"Inpatient",dept:"Cardiology",priority:"High",ago:28+off,conf:0.91});
      visits.push({vid:makeVid(),type:"Emergency",dept:"Cardiology",priority:"Critical",ago:12+off,conf:0.88,diagId:"diag_nstemi",treatName:"Repeat Catheterization",treatCost:180000,claimAmt:180000,claimStatus:"Pending",outcome:"Improved"});
    } else if (jt==="ortho_surgery") {
      visits.push({vid:makeVid(),type:"Outpatient",dept:"Orthopedics",priority:"Medium",ago:60+off,conf:0.96,diagId:"diag_oa_knee",treatName:"Total Knee Replacement",treatCost:350000,claimAmt:350000,claimStatus:Math.random()<0.4?"Denied":"Approved",protocolId:"proto_fracture",outcome:"Recovered"});
      visits.push({vid:makeVid(),type:"Follow-up",dept:"Orthopedics",priority:"Low",ago:20+off,conf:0.93});
    } else if (jt==="ortho_denied") {
      visits.push({vid:makeVid(),type:"Outpatient",dept:"Orthopedics",priority:"Medium",ago:45+off,conf:0.94,diagId:"diag_oa_hip",treatName:"Hip Replacement Surgery",treatCost:420000,claimAmt:420000,claimStatus:"Denied",outcome:"Unchanged"});
    } else if (jt==="diabetes_stable") {
      visits.push({vid:makeVid(),type:"Outpatient",dept:"General Medicine",priority:"Low",ago:90+off,conf:0.92,diagId:"diag_dm2",treatName:"Metformin Therapy",treatCost:2500,claimAmt:2500,claimStatus:"Approved",protocolId:"proto_diabetes",outcome:"Improved"});
      visits.push({vid:makeVid(),type:"Follow-up",dept:"General Medicine",priority:"Low",ago:45+off,conf:0.90});
      visits.push({vid:makeVid(),type:"Follow-up",dept:"General Medicine",priority:"Low",ago:10+off,conf:0.91});
    } else if (jt==="diabetes_crisis") {
      visits.push({vid:makeVid(),type:"Outpatient",dept:"General Medicine",priority:"Medium",ago:90+off,conf:0.93,diagId:"diag_dm2",treatName:"Metformin Therapy",treatCost:2500,claimAmt:2500,claimStatus:"Approved",protocolId:"proto_diabetes",outcome:"Stable"});
      visits.push({vid:makeVid(),type:"Emergency",dept:"Emergency",priority:"Critical",ago:20+off,conf:0.88,diagId:"diag_dka",treatName:"IV Insulin + Fluids",treatCost:35000,claimAmt:35000,claimStatus:"Approved",deviated:true,outcome:"Recovered"});
    } else if (jt==="stroke") {
      visits.push({vid:makeVid(),type:"Emergency",dept:"Emergency",priority:"Critical",ago:15+off,conf:0.94,diagId:"diag_stroke",treatName:"tPA Thrombolysis",treatCost:85000,claimAmt:85000,claimStatus:"Approved",protocolId:"proto_stroke",outcome:Math.random()<0.6?"Improved":"Unchanged"});
      visits.push({vid:makeVid(),type:"Inpatient",dept:"Neurology",priority:"High",ago:10+off,conf:0.91});
      if (Math.random()<0.5) visits.push({vid:makeVid(),type:"Follow-up",dept:"Neurology",priority:"Medium",ago:3+off,conf:0.89});
    } else if (jt==="respiratory") {
      visits.push({vid:makeVid(),type:"Emergency",dept:"Emergency",priority:"High",ago:25+off,conf:0.91,diagId:Math.random()<0.5?"diag_pneumonia":"diag_copd",treatName:"Antibiotics + O2 Therapy",treatCost:28000,claimAmt:28000,claimStatus:"Approved",protocolId:"proto_pneumonia",outcome:"Recovered"});
      if (Math.random()<0.4) visits.push({vid:makeVid(),type:"Follow-up",dept:"Pulmonology",priority:"Low",ago:10+off,conf:0.88});
    } else if (jt==="renal") {
      visits.push({vid:makeVid(),type:"Outpatient",dept:"Nephrology",priority:"Medium",ago:120+off,conf:0.93,diagId:"diag_ckd3",treatName:"ACE Inhibitor + Diet",treatCost:5000,claimAmt:5000,claimStatus:"Approved",protocolId:"proto_ckd",outcome:"Stable"});
      visits.push({vid:makeVid(),type:"Outpatient",dept:"Nephrology",priority:"Medium",ago:60+off,conf:0.91});
      if (Math.random()<0.3) visits.push({vid:makeVid(),type:"Emergency",dept:"Emergency",priority:"Critical",ago:10+off,conf:0.87,diagId:"diag_ckd5",treatName:"Emergency Dialysis",treatCost:95000,claimAmt:95000,claimStatus:"Approved",outcome:"Stable"});
    } else if (jt==="gi") {
      visits.push({vid:makeVid(),type:"Emergency",dept:"Emergency",priority:"High",ago:20+off,conf:0.92,diagId:"diag_appendicitis",treatName:"Appendectomy",treatCost:75000,claimAmt:75000,claimStatus:"Approved",outcome:"Recovered"});
      visits.push({vid:makeVid(),type:"Follow-up",dept:"Gastroenterology",priority:"Low",ago:8+off,conf:0.94});
    } else if (jt==="neurology") {
      visits.push({vid:makeVid(),type:"Outpatient",dept:"Neurology",priority:"Medium",ago:40+off,conf:0.91,diagId:Math.random()<0.5?"diag_migraine":"diag_epilepsy",treatName:"Medication Management",treatCost:3500,claimAmt:3500,claimStatus:"Approved",outcome:"Improved"});
      if (Math.random()<0.5) visits.push({vid:makeVid(),type:"Follow-up",dept:"Neurology",priority:"Low",ago:10+off,conf:0.90});
    } else {
      // er_only
      visits.push({vid:makeVid(),type:"Emergency",dept:"Emergency",priority:pick(["High","Critical","Medium"]),ago:ri(5,30)+off,conf:0.90,outcome:pick(["Recovered","Discharged","Improved"])});
    }

    // Write visits
    let prevVid: string|null = null;
    for (const v of visits) {
      await runQuery(
        `MATCH (p:Profile {profile_id:$pid,_tenant:$t})
         CREATE (vi:Visit {visit_id:$vid,type:$type,timestamp:datetime($ts),department:$dept,status:'Discharged',priority:$pri,confidence_score:$conf,duration_hours:$dur,_tenant:$t})
         CREATE (p)-[:HAD_VISIT]->(vi)`,
        {pid,t:T,vid:v.vid,type:v.type,ts:da(v.ago),dept:v.dept,pri:v.priority,conf:v.conf,dur:ri(2,72)}
      );

      if (prevVid) await runQuery(`MATCH (a:Visit {visit_id:$a,_tenant:$t}) MATCH (b:Visit {visit_id:$b,_tenant:$t}) CREATE (a)-[:NEXT]->(b)`,{a:prevVid,b:v.vid,t:T});
      prevVid = v.vid;

      const prov = PROVIDERS.find(p => p.dept===v.dept) || provider;
      await runQuery(`MATCH (vi:Visit {visit_id:$vid,_tenant:$t}) MATCH (pr:Provider {provider_id:$pid,_tenant:$t}) CREATE (vi)-[:ATTENDED_BY]->(pr)`,{vid:v.vid,t:T,pid:prov.id});
      await runQuery(`MATCH (vi:Visit {visit_id:$vid,_tenant:$t}) MATCH (d:Department {name:$dept,_tenant:$t}) CREATE (vi)-[:IN_DEPARTMENT]->(d)`,{vid:v.vid,t:T,dept:v.dept});

      if (v.diagId) {
        const diag = DIAGNOSES.find(d=>d.id===v.diagId) || DIAGNOSES[0];
        await runQuery(`MATCH (vi:Visit {visit_id:$vid,_tenant:$t}) MERGE (d:Diagnosis {name:$name,_tenant:$t}) ON CREATE SET d.diagnosis_id=$did,d.icd_code=$icd,d.severity=$sev,d.chronic=false CREATE (vi)-[:DIAGNOSED_WITH]->(d)`,{vid:v.vid,t:T,name:diag.name,did:`diag_${uuidv4().slice(0,8)}`,icd:diag.icd,sev:diag.sev});
      }

      if (v.treatName) {
        await runQuery(`MATCH (vi:Visit {visit_id:$vid,_tenant:$t}) CREATE (tr:Treatment {treatment_id:$tid,name:$name,type:'Procedure',cost:$cost,_tenant:$t}) CREATE (vi)-[:TREATED_WITH]->(tr)`,{vid:v.vid,t:T,tid:`treat_${uuidv4().slice(0,8)}`,name:v.treatName,cost:v.treatCost||0});
      }

      if (v.protocolId) {
        const rel = v.deviated?"DEVIATED_FROM":"GOVERNED_BY";
        await runQuery(`MATCH (vi:Visit {visit_id:$vid,_tenant:$t}) MATCH (pt:Protocol {protocol_id:$pid,_tenant:$t}) CREATE (vi)-[:${rel}]->(pt)`,{vid:v.vid,t:T,pid:v.protocolId});
      }

      if (v.claimAmt) {
        await runQuery(`MATCH (vi:Visit {visit_id:$vid,_tenant:$t}) CREATE (ic:InsuranceClaim {claim_id:$cid,amount:$amt,status:$status,payer:$payer,_tenant:$t}) CREATE (vi)-[:CLAIMED_VIA]->(ic)`,{vid:v.vid,t:T,cid:`clm_${uuidv4().slice(0,8)}`,amt:v.claimAmt,status:v.claimStatus||"Pending",payer:insurer});
        if (v.claimStatus==="Denied") {
          await runQuery(`MATCH (vi:Visit {visit_id:$vid,_tenant:$t})-[:CLAIMED_VIA]->(ic:InsuranceClaim) SET ic.denial_reason='Pre-authorization not filed'`,{vid:v.vid,t:T});
        }
      }

      if (v.outcome) {
        await runQuery(`MATCH (vi:Visit {visit_id:$vid,_tenant:$t}) CREATE (o:Outcome {outcome_id:$oid,type:$type,readmission:$readmit,days_to_readmission:$dtr,follow_up_scheduled:$fup,_tenant:$t}) CREATE (vi)-[:RESULTED_IN]->(o)`,{vid:v.vid,t:T,oid:`out_${uuidv4().slice(0,8)}`,type:v.outcome,readmit:v.readmit||false,dtr:v.daysToReadmit||null,fup:!v.deviated});
        if (v.readmit) await runQuery(`MATCH (p:Profile {profile_id:$pid,_tenant:$t})-[:HAD_VISIT]->(vi:Visit {visit_id:$vid,_tenant:$t}) CREATE (p)-[:READMITTED {days_gap:$gap}]->(vi)`,{pid,t:T,vid:v.vid,gap:v.daysToReadmit||20});
      }

      // Commitment for missed follow-ups
      if (v.deviated && v.protocolId==="proto_stemi_v2") {
        const dl = new Date(); dl.setDate(dl.getDate()-(v.ago-14));
        const cid = `commit_${uuidv4().slice(0,8)}`;
        await runQuery(
          `MATCH (p:Profile {profile_id:$pid,_tenant:$t}) MATCH (vi:Visit {visit_id:$vid,_tenant:$t})
           CREATE (c:Commitment {commitment_id:$cid,promise_text:'Follow-up angiogram in 2 weeks',deadline:datetime($dl),status:$status,assignee:$assignee,confidence_score:0.94,_tenant:$t,created_at:datetime()})
           CREATE (p)-[:HAS_COMMITMENT]->(c) CREATE (vi)-[:CREATED_COMMITMENT]->(c)`,
          {pid,t:T,vid:v.vid,cid,dl:dl.toISOString(),status:dl<new Date()?"breached":"open",assignee:prov.name}
        );
      }

      ev++;
    }
  }

  return {profiles:200,events:ev};
}
