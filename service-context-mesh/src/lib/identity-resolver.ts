import { v4 as uuidv4 } from "uuid";
import { runQuery } from "./neo4j";

interface Identifier {
  type: string;
  value: string;
  source?: string;
}

interface ResolveResult {
  profileId: string;
  isNew: boolean;
  merged: boolean;
  identitiesMatched: string[];
  identitiesAdded: string[];
}

const STRONG_TYPES = ["email", "phone", "mrn", "crm_id", "aadhaar"];

function getStrength(type: string): string {
  if (STRONG_TYPES.includes(type)) return "strong";
  if (["device_id"].includes(type)) return "medium";
  return "weak";
}

export async function resolveIdentity(
  identifiers: Record<string, string>,
  tenantId: string,
  profileData?: Record<string, unknown>
): Promise<ResolveResult> {
  const idList: Identifier[] = Object.entries(identifiers)
    .filter(([, v]) => v)
    .map(([type, value]) => ({ type, value }));

  if (idList.length === 0) {
    // No identifiers — create anonymous profile
    const profileId = `prof_${uuidv4().slice(0, 8)}`;
    await createProfile(profileId, tenantId, profileData);
    return { profileId, isNew: true, merged: false, identitiesMatched: [], identitiesAdded: [] };
  }

  // Step 1: Look up all provided identifiers
  const results = await runQuery<{
    profile_id: string;
    identity_type: string;
    identity_value: string;
  }>(
    `
    UNWIND $identifiers AS ident
    OPTIONAL MATCH (i:Identity {type: ident.type, value: ident.value, _tenant: $tenantId})
                   <-[:HAS_IDENTITY]-(p:Profile)
    RETURN p.profile_id AS profile_id, ident.type AS identity_type, ident.value AS identity_value
    `,
    { identifiers: idList.map((i) => ({ type: i.type, value: i.value })), tenantId }
  );

  const matchedProfiles = new Set<string>();
  const matchedIdentities: string[] = [];
  const unmatchedIdentities: Identifier[] = [];

  for (const r of results) {
    if (r.profile_id) {
      matchedProfiles.add(r.profile_id);
      matchedIdentities.push(r.identity_type);
    } else {
      const id = idList.find((i) => i.type === r.identity_type && i.value === r.identity_value);
      if (id) unmatchedIdentities.push(id);
    }
  }

  const profileIds = Array.from(matchedProfiles);

  // Case 1: No match — create new profile
  if (profileIds.length === 0) {
    const profileId = `prof_${uuidv4().slice(0, 8)}`;
    await createProfile(profileId, tenantId, profileData);
    for (const id of idList) {
      await createIdentity(profileId, id, tenantId);
    }
    return {
      profileId,
      isNew: true,
      merged: false,
      identitiesMatched: [],
      identitiesAdded: idList.map((i) => i.type),
    };
  }

  // Case 2: One match — use existing, add new identities
  if (profileIds.length === 1) {
    const profileId = profileIds[0];
    for (const id of unmatchedIdentities) {
      await createIdentity(profileId, id, tenantId);
    }
    if (profileData) {
      await enrichProfile(profileId, tenantId, profileData);
    }
    return {
      profileId,
      isNew: false,
      merged: false,
      identitiesMatched: matchedIdentities,
      identitiesAdded: unmatchedIdentities.map((i) => i.type),
    };
  }

  // Case 3: Multiple matches — merge profiles
  const canonical = profileIds[0];
  for (const otherId of profileIds.slice(1)) {
    await mergeProfiles(canonical, otherId, tenantId);
  }
  for (const id of unmatchedIdentities) {
    await createIdentity(canonical, id, tenantId);
  }
  if (profileData) {
    await enrichProfile(canonical, tenantId, profileData);
  }
  return {
    profileId: canonical,
    isNew: false,
    merged: true,
    identitiesMatched: matchedIdentities,
    identitiesAdded: unmatchedIdentities.map((i) => i.type),
  };
}

async function createProfile(
  profileId: string,
  tenantId: string,
  data?: Record<string, unknown>
): Promise<void> {
  const props = { ...data, profile_id: profileId, _tenant: tenantId, created_at: new Date().toISOString() };
  const setClause = Object.keys(props)
    .map((k) => `p.${k} = $props.${k}`)
    .join(", ");
  await runQuery(`CREATE (p:Profile) SET ${setClause}`, { props });
}

async function createIdentity(
  profileId: string,
  identifier: Identifier,
  tenantId: string
): Promise<void> {
  await runQuery(
    `
    MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
    CREATE (i:Identity {
      identity_id: $identityId,
      type: $type,
      value: $value,
      source: $source,
      strength: $strength,
      verified: $verified,
      first_seen: datetime(),
      _tenant: $tenantId
    })
    CREATE (p)-[:HAS_IDENTITY]->(i)
    `,
    {
      profileId,
      tenantId,
      identityId: `ident_${uuidv4().slice(0, 8)}`,
      type: identifier.type,
      value: identifier.value,
      source: identifier.source || "api",
      strength: getStrength(identifier.type),
      verified: STRONG_TYPES.includes(identifier.type),
    }
  );
}

async function enrichProfile(
  profileId: string,
  tenantId: string,
  data: Record<string, unknown>
): Promise<void> {
  const entries = Object.entries(data).filter(([, v]) => v != null);
  if (entries.length === 0) return;
  const setClause = entries.map(([k]) => `p.${k} = $data.${k}`).join(", ");
  await runQuery(
    `MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId}) SET ${setClause}, p.updated_at = datetime()`,
    { profileId, tenantId, data }
  );
}

async function mergeProfiles(
  winnerId: string,
  loserId: string,
  tenantId: string
): Promise<void> {
  const params = { winnerId, loserId, tenantId };

  // Reparent each known relationship type explicitly (no APOC needed)
  // Whitelist prevents Cypher injection via interpolated relType
  const ALLOWED_REL_TYPES = ["PERFORMED", "HAD_VISIT", "HAS_SESSION", "HAS_COMMITMENT", "READMITTED"];
  for (const relType of ALLOWED_REL_TYPES) {
    await runQuery(
      `
      MATCH (loser:Profile {profile_id: $loserId, _tenant: $tenantId})-[r:${relType}]->(n)
      MATCH (winner:Profile {profile_id: $winnerId, _tenant: $tenantId})
      CREATE (winner)-[:${relType}]->(n)
      DELETE r
      `,
      params
    ).catch((err) => {
      // Expected for relationship types that don't exist in this vertical
      console.debug(`Merge reparent skip: ${relType} — ${err.message}`);
    });
  }

  // Move identities
  await runQuery(
    `
    MATCH (loser:Profile {profile_id: $loserId, _tenant: $tenantId})-[r:HAS_IDENTITY]->(i:Identity)
    MATCH (winner:Profile {profile_id: $winnerId, _tenant: $tenantId})
    MERGE (winner)-[:HAS_IDENTITY]->(i)
    DELETE r
    `,
    params
  );

  // Tombstone loser profile — never hard delete (audit trail)
  await runQuery(
    `
    MATCH (loser:Profile {profile_id: $loserId, _tenant: $tenantId})
    MATCH (winner:Profile {profile_id: $winnerId, _tenant: $tenantId})
    SET loser.archived = true,
        loser.merged_into = $winnerId,
        loser.archived_at = datetime()
    CREATE (loser)-[:MERGED_INTO {merged_at: datetime()}]->(winner)
    `,
    params
  );
}
