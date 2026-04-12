import type {
  NurixVoiceCall,
  NurixAgent,
  Journey,
  ConversationEvent,
  JourneyInsights,
  Sentiment,
  Outcome,
  Intent,
} from './nurix-types'
import type { NurixConfig } from './nurix-api'
import { lookupUserByPhone, fetchAllCallsForUser, listAgents } from './nurix-api'

const agentNameCache: Record<string, Record<string, string>> = {}

async function getAgentNameMap(config: NurixConfig): Promise<Record<string, string>> {
  const key = config.workspaceId
  if (agentNameCache[key]) return agentNameCache[key]
  const agents: NurixAgent[] = await listAgents(config)
  const map: Record<string, string> = {}
  for (const a of agents) map[a.agent_id] = a.agent_name
  agentNameCache[key] = map
  return map
}

function callToEvent(call: NurixVoiceCall, agentNames: Record<string, string>): ConversationEvent {
  const summary = call.call_context?.conversation_summary ?? null
  return {
    id: call.call_id,
    type: 'call',
    channel: 'phone',
    timestamp: call.start_time,
    intent: deriveIntent(call, summary),
    sentiment: deriveSentiment(summary),
    outcome: deriveOutcome(call),
    agent_id: call.agent_id,
    agent_name: agentNames[call.agent_id] ?? call.agent_id,
    duration: call.duration ?? undefined,
    direction: call.direction,
    transcript_snippet: summary ?? undefined,
    call_end_reason: call.call_end_reason ?? undefined,
    human_transfer_status: call.human_transfer_status ?? undefined,
    metadata: {
      campaign_id: call.campaign_id,
      lead_id: call.lead_id,
      user_turn_count: call.call_context?.user_turn_count,
      agent_turn_count: call.call_context?.agent_turn_count,
      customer_name: call.additional_info?.custom_dynamic_variables_config?.customer_name,
      job_id: call.additional_info?.custom_dynamic_variables_config?.job_id,
    },
  }
}

function deriveIntent(call: NurixVoiceCall, summary: string | null): Intent {
  const text = (call.agent_id + ' ' + (summary ?? '')).toLowerCase()
  if (text.includes('checkin') || text.includes('check-in')) return 'checkin'
  if (text.includes('checkout') || text.includes('check-out')) return 'checkout'
  if (text.includes('address')) return 'complaint'
  if (summary?.toLowerCase().includes('supervisor') || summary?.toLowerCase().includes('transfer')) return 'escalation'
  return 'unknown'
}

function deriveSentiment(summary: string | null): Sentiment {
  if (!summary) return 'neutral'
  const lower = summary.toLowerCase()
  const neg = ['issue', 'problem', 'declined', 'not available', 'frustrated', 'cancel'].filter(s => lower.includes(s)).length
  const pos = ['completed', 'confirmed', 'agreed', 'accepted', 'done'].filter(s => lower.includes(s)).length
  if (neg > pos) return 'negative'
  if (pos > neg) return 'positive'
  return 'neutral'
}

function deriveOutcome(call: NurixVoiceCall): Outcome {
  const summary = (call.call_context?.conversation_summary ?? '').toLowerCase()
  const status = (call.status ?? '').toUpperCase()
  if (status === 'FAILED' || status === 'NO_ANSWER' || status === 'BUSY') return 'failed'
  if (call.human_transfer_status === 'COMPLETED' || summary.includes('transferred')) return 'transferred'
  if (summary.includes('declined') || summary.includes('cancel')) return 'dropped'
  if (summary.includes('completed') || summary.includes('confirmed')) return 'completed'
  if (summary.includes('issue') || summary.includes('problem')) return 'follow_up_needed'
  if (status === 'CONNECTED') return 'completed'
  return 'in_progress'
}

function deriveInsights(events: ConversationEvent[]): JourneyInsights {
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  if (!sorted.length) return { total_touchpoints: 0, entry_point: null, drop_off_point: null, conversion_point: null, re_entry_point: null, overall_sentiment: 'neutral', journey_outcome: null, total_duration_seconds: 0, agents_involved: [], date_range: { start: '', end: '' } }
  const dropOff = sorted.find(e => e.outcome === 'dropped') ?? null
  const conversion = sorted.find(e => e.outcome === 'completed') ?? null
  const reEntry = dropOff ? sorted[sorted.indexOf(dropOff) + 1] ?? null : null
  const sc: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 }
  let dur = 0
  const agents = new Set<string>()
  for (const e of events) { sc[e.sentiment]++; dur += e.duration ?? 0; agents.add(e.agent_name) }
  const overall = (Object.entries(sc) as [Sentiment, number][]).reduce((b, c) => c[1] > b[1] ? c : b, ['neutral' as Sentiment, 0])[0]
  const rank: Record<string, number> = { completed: 5, in_progress: 4, follow_up_needed: 3, transferred: 2, dropped: 1, failed: 0 }
  let outcome: Outcome = null
  for (const e of events) { if (e.outcome && (rank[e.outcome] ?? -1) > (rank[outcome ?? ''] ?? -1)) outcome = e.outcome }
  return { total_touchpoints: events.length, entry_point: sorted[0], drop_off_point: dropOff, conversion_point: conversion, re_entry_point: reEntry, overall_sentiment: overall, journey_outcome: outcome, total_duration_seconds: dur, agents_involved: Array.from(agents), date_range: { start: sorted[0]?.timestamp ?? '', end: sorted[sorted.length - 1]?.timestamp ?? '' } }
}

export async function buildJourneyFromPhone(phone: string, config: NurixConfig): Promise<Journey> {
  const user = await lookupUserByPhone(phone, config)
  const calls = await fetchAllCallsForUser(user.user_id, config)
  const agentNames = calls.length > 0 ? await getAgentNameMap(config) : {}
  const events = calls.map(call => callToEvent(call, agentNames))
  const insights = deriveInsights(events)
  const customerName = calls.find(c => c.additional_info?.custom_dynamic_variables_config?.customer_name)?.additional_info?.custom_dynamic_variables_config?.customer_name ?? null
  return { user_id: user.user_id, phone_number: user.decrypted_identifier ?? user.masked_identifier, customer_name: customerName, workspace_id: user.workspace_id, events, insights, enriched_at: new Date().toISOString() }
}
