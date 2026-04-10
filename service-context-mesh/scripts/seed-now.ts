import { seedHealthcare } from "../src/verticals/healthcare/seed";
import { initSchema } from "../src/lib/neo4j";
import { getVertical } from "../src/verticals/registry";

const TENANT_ID = "e40b5f61ae204f52ce02d5c5"; // Care Hospitals

async function main() {
  console.log("Initializing schema...");
  const config = getVertical("healthcare");
  await initSchema(config.constraints, config.indexes);
  console.log("Seeding healthcare data...");
  const result = await seedHealthcare(TENANT_ID);
  console.log("Done:", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
