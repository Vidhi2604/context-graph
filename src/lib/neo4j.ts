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

export async function initSchema(): Promise<void> {
  await runQuery(
    "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.user_id IS UNIQUE"
  );
  await runQuery(
    "CREATE INDEX event_timestamp IF NOT EXISTS FOR (e:Event) ON (e.timestamp)"
  );
  await runQuery(
    "CREATE INDEX event_type IF NOT EXISTS FOR (e:Event) ON (e.event_type)"
  );
  await runQuery(
    "CREATE INDEX session_id IF NOT EXISTS FOR (s:Session) ON (s.session_id)"
  );
}
