
import type {
  NurixUser,
  NurixAgent,
  NurixVoiceCall,
  NurixRecentCallResponse,
} from './nurix-types'

export interface NurixConfig {
  baseUrl: string
  workspaceId: string
  apiKey?: string
}

function buildHeaders(config: NurixConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'workspace-id': config.workspaceId,
    'Content-Type': 'application/json',
  }
  if (config.apiKey) {
    headers.Authorization = /^Bearer\s/i.test(config.apiKey) ? config.apiKey : `Bearer ${config.apiKey}`
  }
  return headers
}

async function fetchJson<T>(url: string, config: NurixConfig, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...buildHeaders(config), ...(init?.headers || {}) },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AgentX ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export async function lookupUserByPhone(phone: string, config: NurixConfig): Promise<NurixUser> {
  const compact = phone.trim().replace(/[\s\-\(\)]+/g, '')
  const normalized = compact.startsWith('+')
    ? compact
    : `+91${compact.replace(/^0+/, '')}`
  const base = config.baseUrl.replace(/\/+$/, '')
  return fetchJson<NurixUser>(`${base}/voice/users/phone/${encodeURIComponent(normalized)}`, config)
}

export async function listAgents(config: NurixConfig): Promise<NurixAgent[]> {
  const base = config.baseUrl.replace(/\/+$/, '')
  const data = await fetchJson<NurixAgent[] | { agents: NurixAgent[] } | { data: NurixAgent[] }>(
    `${base}/agent/list`, config
  )
  if (Array.isArray(data)) return data
  if ('agents' in data && Array.isArray(data.agents)) return data.agents
  if ('data' in data && Array.isArray(data.data)) return data.data
  return []
}

export async function getRecentCallIds(userId: string, agentId: string, config: NurixConfig): Promise<NurixRecentCallResponse> {
  const base = config.baseUrl.replace(/\/+$/, '')
  return fetchJson<NurixRecentCallResponse>(
    `${base}/voice/call/${userId}/recent-call`,
    config,
    { method: 'POST', body: JSON.stringify({ agent_id: agentId }) }
  )
}

export async function getCallDetail(callId: string, config: NurixConfig): Promise<NurixVoiceCall> {
  const base = config.baseUrl.replace(/\/+$/, '')
  return fetchJson<NurixVoiceCall>(`${base}/voice/call/${callId}`, config)
}

export async function fetchAllCallsForUser(userId: string, config: NurixConfig): Promise<NurixVoiceCall[]> {
  const agents = await listAgents(config)

  const recentCallResults = await Promise.allSettled(
    agents.map((agent) => getRecentCallIds(userId, agent.agent_id, config))
  )

  const callIdSet = new Set<string>()
  for (const result of recentCallResults) {
    if (result.status === 'fulfilled') {
      const ids = result.value.previous_call_ids || (result.value.previous_call_id ? [result.value.previous_call_id] : [])
      for (const id of ids) callIdSet.add(id)
    }
  }

  if (callIdSet.size === 0) return []

  const callIds = Array.from(callIdSet)
  const calls: NurixVoiceCall[] = []

  for (let i = 0; i < callIds.length; i += 10) {
    const batch = callIds.slice(i, i + 10)
    const results = await Promise.allSettled(batch.map(id => getCallDetail(id, config)))
    for (const result of results) {
      if (result.status === 'fulfilled') calls.push(result.value)
    }
  }

  calls.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  return calls
}
