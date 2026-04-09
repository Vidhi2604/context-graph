import neo4j, { Driver } from "neo4j-driver";

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI!;
    const user = process.env.NEO4J_USER || "neo4j";
    const password = process.env.NEO4J_PASSWORD!;
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }
  return driver;
}

export async function runQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const session = getDriver().session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((r) => r.toObject() as T);
  } finally {
    await session.close();
  }
}

export async function runWrite(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<void> {
  const session = getDriver().session();
  try {
    await session.executeWrite((tx) => tx.run(cypher, params));
  } finally {
    await session.close();
  }
}

export async function initSchema(
  constraints: string[],
  indexes: string[]
): Promise<void> {
  for (const c of constraints) {
    try {
      await runQuery(c);
    } catch {
      // Constraint may already exist
    }
  }
  for (const idx of indexes) {
    try {
      await runQuery(idx);
    } catch {
      // Index may already exist
    }
  }
}
