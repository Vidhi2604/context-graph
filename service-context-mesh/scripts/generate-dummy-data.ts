/**
 * generate-dummy-data.ts
 * Generates 5000-row CSV files for retail and healthcare verticals.
 * Run: npx tsx scripts/generate-dummy-data.ts
 */
import * as fs from "fs";
import * as path from "path";

const OUT_DIR = path.join(process.cwd(), "scripts", "data");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}
function randomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().replace("T", " ").slice(0, 19);
}
function uuid(prefix: string, i: number) {
  return `${prefix}-${String(i).padStart(6, "0")}`;
}

// ─── RETAIL ──────────────────────────────────────────────────────────────────

const RETAIL_NAMES = [
  "Ananya Krishnan","Rohit Verma","Meera Patel","Karthik Nair","Divya Ramesh",
  "Vijay Anand","Sunita Singh","Arjun Mehta","Pooja Sharma","Rahul Gupta",
  "Priya Nair","Aditya Kumar","Sneha Iyer","Siddharth Rao","Kavya Reddy",
  "Nikhil Joshi","Deepika Menon","Vikram Shah","Asha Pillai","Ravi Shankar",
  "Lakshmi Venkat","Mohammed Farooq","Anita Desai","Suresh Babu","Neha Jain",
];
const CITIES = ["Bangalore","Mumbai","Delhi","Chennai","Hyderabad","Pune","Kolkata","Ahmedabad","Jaipur","Surat"];
const TIERS = ["Bronze","Bronze","Bronze","Silver","Silver","Gold","Gold","Platinum"];
const EVENT_TYPES = ["purchase","purchase","purchase","return_initiated","checkout_drop","wishlist_add","cart_add","review_submitted","refund_processed","exchange_requested"];
const CHANNELS = ["app","app","web","web","store","store"];
const BRANDS = ["Nike","Puma","Adidas","Levis","H&M","Zara","Arrow","Van Heusen","Woodland","Bata","Ray-Ban","Fastrack","Titan","Wildcraft","Decathlon"];
const CATEGORIES = ["Footwear","Footwear","Apparel","Apparel","Accessories","Sports","Innerwear"];
const PAYMENT_METHODS = ["UPI","UPI","Credit Card","Debit Card","COD","Net Banking","Wallet"];
const STATUSES = ["completed","completed","completed","pending","exception","refunded","cancelled"];
const RETURN_REASONS = ["size_issue","quality_issue","colour_mismatch","wrong_item","defective","changed_mind","better_price_elsewhere"];

function generateRetailRow(i: number): string {
  const profileNum = randInt(1, 2000); // 2000 unique profiles across 5000 events
  const profileId = uuid("prof", profileNum);
  const name = RETAIL_NAMES[profileNum % RETAIL_NAMES.length] + " " + profileNum;
  const email = `user${profileNum}@myntra-demo.com`;
  const phone = `+91${9000000000 + profileNum}`;
  const tier = TIERS[profileNum % TIERS.length];
  const city = CITIES[profileNum % CITIES.length];
  const ltv = randFloat(500, 250000);

  const eventId = uuid("evt", i);
  const eventType = rand(EVENT_TYPES);
  const timestamp = randomDate(new Date("2025-06-01"), new Date("2026-04-01"));
  const amount = randFloat(299, 24999);
  const channel = rand(CHANNELS);
  const status = rand(STATUSES);

  const productId = uuid("prod", randInt(1, 200));
  const brand = rand(BRANDS);
  const category = rand(CATEGORIES);
  const productName = `${brand} ${category} ${randInt(100, 999)}`;
  const price = randFloat(299, 19999);

  const paymentMethod = rand(PAYMENT_METHODS);
  const paymentId = uuid("pay", i);

  const agentId = uuid("agent", randInt(1, 20));
  const agentName = rand(["Priya Sharma","Rahul Mehta","Anjali Rao","Deepak Singh","Meena Pillai"]);

  const returnReason = eventType === "return_initiated" ? rand(RETURN_REASONS) : "";
  const exception = (eventType === "return_initiated" && Math.random() > 0.7) || status === "exception" ? "true" : "false";
  const confidenceScore = randFloat(0.75, 0.99);

  return [
    profileId, name, email, phone, tier, city, ltv,
    eventId, eventType, timestamp, amount, channel, status,
    productId, productName, brand, category, price,
    paymentId, paymentMethod,
    agentId, agentName,
    returnReason, exception, confidenceScore
  ].map(v => `"${v}"`).join(",");
}

function writeRetailCSV() {
  const ROWS = 25000;
  const headers = [
    "profile_id","name","email","phone","tier","city","ltv",
    "event_id","event_type","timestamp","amount","channel","status",
    "product_id","product_name","brand","category","price",
    "payment_id","payment_method",
    "agent_id","agent_name",
    "return_reason","exception","confidence_score"
  ].join(",");

  const lines = [headers];
  for (let i = 1; i <= ROWS; i++) {
    lines.push(generateRetailRow(i));
  }

  const outPath = path.join(OUT_DIR, "retail-25000.csv");
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
  console.log(`✅ Retail CSV written: ${outPath} (${ROWS} rows, ${headers.split(",").length} columns)`);
}

// ─── HEALTHCARE ───────────────────────────────────────────────────────────────

const PATIENT_NAMES = [
  "Suresh Kumar","Radha Iyer","Arjun Mehta","Priya Nambiar","Mohammed Farooq",
  "Lakshmi Venkat","Deepak Pillai","Kavitha Suresh","Rajesh Sharma","Anita Gupta",
  "Vikram Nair","Sunita Rao","Ganesh Patel","Meena Krishnan","Ravi Verma",
  "Saranya Pillai","Arun Menon","Leela Devi","Harish Babu","Pooja Agarwal",
  "Sanjay Bose","Usha Nair","Dilip Joshi","Rekha Shah","Mohan Reddy",
];
const DEPARTMENTS = ["Cardiology","Orthopedics","General Medicine","Emergency","Neurology","Pulmonology","Oncology","Gastroenterology","Pediatrics","Dermatology"];
const VISIT_TYPES = ["Emergency","Emergency","Outpatient","Outpatient","Inpatient","Follow-up","Follow-up","Surgery"];
const PRIORITIES = ["Critical","High","High","Medium","Medium","Low"];
const VISIT_STATUSES = ["Discharged","Discharged","Discharged","Active","Transferred"];
const GENDERS = ["Male","Female","Other"];
const BLOOD_GROUPS = ["A+","A-","B+","B-","O+","O-","AB+","AB-"];
const INSURANCE_PROVIDERS = ["Star Health","Bajaj Allianz","HDFC Ergo","LIC Health","United Health","Max Bupa","New India","Oriental Insurance","National Insurance","Care Health"];
const DIAGNOSES = [
  ["I21.0","Acute Myocardial Infarction","Critical"],
  ["E11.9","Type 2 Diabetes Mellitus","Moderate"],
  ["M17.11","Primary Osteoarthritis Knee","Moderate"],
  ["I10","Essential Hypertension","Moderate"],
  ["G43.909","Migraine","Mild"],
  ["J18.9","Pneumonia","Severe"],
  ["N18.3","Chronic Kidney Disease Stage 3","Severe"],
  ["K21.0","GERD with Oesophagitis","Mild"],
  ["J45.50","Severe Persistent Asthma","Severe"],
  ["C50.911","Breast Cancer","Critical"],
  ["I63.9","Cerebral Infarction","Critical"],
  ["M54.5","Low Back Pain","Mild"],
  ["F32.1","Major Depressive Disorder","Moderate"],
  ["K80.20","Cholelithiasis","Moderate"],
  ["B06.9","Rubella","Mild"],
];
const PROVIDERS = [
  "Dr. Rajesh Sharma","Dr. Anita Gupta","Dr. Vikram Mehta","Dr. Sunita Rao",
  "Dr. Karthik Nair","Dr. Priya Pillai","Dr. Suresh Iyer","Dr. Meena Reddy",
  "Dr. Arun Kumar","Dr. Divya Menon",
];
const CLAIM_STATUSES = ["Approved","Approved","Approved","Denied","Pending","Partial"];
const DENIAL_REASONS = ["Pre-existing condition","Policy lapsed","Waiting period not met","Non-network hospital","Insufficient documentation","Claim limit exceeded",""];
const MEDICATIONS = [
  "Metformin 500mg","Insulin Glargine 20U","Aspirin 75mg","Metoprolol 50mg",
  "Atorvastatin 40mg","Amlodipine 5mg","Pantoprazole 40mg","Paracetamol 650mg",
  "Clopidogrel 75mg","Losartan 50mg","Salbutamol inhaler","Prednisolone 10mg",
];
const TREATMENT_TYPES = ["Procedure","Surgery","Therapy","Observation","Medication"];

function generateHealthcareRow(i: number): string {
  const patientNum = randInt(1, 2000);
  const profileId = uuid("pat", patientNum);
  const name = PATIENT_NAMES[patientNum % PATIENT_NAMES.length] + " " + patientNum;
  const email = `patient${patientNum}@cityhospital-demo.com`;
  const phone = `+91${8000000000 + patientNum}`;
  const age = randInt(18, 85);
  const gender = rand(GENDERS);
  const bloodGroup = rand(BLOOD_GROUPS);
  const city = rand(CITIES);
  const insuranceProvider = rand(INSURANCE_PROVIDERS);

  const visitId = uuid("visit", i);
  const visitType = rand(VISIT_TYPES);
  const timestamp = randomDate(new Date("2025-06-01"), new Date("2026-04-01"));
  const department = rand(DEPARTMENTS);
  const visitStatus = rand(VISIT_STATUSES);
  const priority = rand(PRIORITIES);
  const durationHours = randFloat(0.5, 240);

  const diag = rand(DIAGNOSES);
  const icdCode = diag[0];
  const diagnosisName = diag[1];
  const severity = diag[2];
  const chronic = Math.random() > 0.5 ? "true" : "false";

  const provider = rand(PROVIDERS);
  const providerId = uuid("prov", PROVIDERS.indexOf(provider) + 1);

  const medication = rand(MEDICATIONS);
  const treatmentType = rand(TREATMENT_TYPES);
  const treatmentCost = randFloat(500, 500000);

  const claimId = uuid("claim", i);
  const claimAmount = randFloat(5000, 500000);
  const claimStatus = rand(CLAIM_STATUSES);
  const denialReason = claimStatus === "Denied" ? rand(DENIAL_REASONS.slice(0, -1)) : "";

  const readmission = Math.random() > 0.85 ? "true" : "false";
  const daysToReadmission = readmission === "true" ? randInt(1, 30) : "";
  const confidenceScore = randFloat(0.80, 0.99);

  return [
    profileId, name, email, phone, age, gender, bloodGroup, city, insuranceProvider,
    visitId, visitType, timestamp, department, visitStatus, priority, durationHours,
    icdCode, diagnosisName, severity, chronic,
    providerId, provider,
    medication, treatmentType, treatmentCost,
    claimId, claimAmount, claimStatus, denialReason,
    readmission, daysToReadmission, confidenceScore
  ].map(v => `"${v}"`).join(",");
}

function writeHealthcareCSV() {
  const ROWS = 25000;
  const headers = [
    "profile_id","name","email","phone","age","gender","blood_group","city","insurance_provider",
    "visit_id","type","timestamp","department","status","priority","duration_hours",
    "icd_code","diagnosis_name","severity","chronic",
    "provider_id","provider_name",
    "medication","treatment_type","treatment_cost",
    "claim_id","claim_amount","claim_status","denial_reason",
    "readmission","days_to_readmission","confidence_score"
  ].join(",");

  const lines = [headers];
  for (let i = 1; i <= ROWS; i++) {
    lines.push(generateHealthcareRow(i));
  }

  const outPath = path.join(OUT_DIR, "healthcare-25000.csv");
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
  console.log(`✅ Healthcare CSV written: ${outPath} (${ROWS} rows, ${headers.split(",").length} columns)`);
}

// ─── RUN ─────────────────────────────────────────────────────────────────────
writeRetailCSV();
writeHealthcareCSV();
console.log("\n📁 Files saved to scripts/data/");
console.log("   retail-25000.csv     — 25 columns, 25000 rows");
console.log("   healthcare-25000.csv — 32 columns, 25000 rows");
