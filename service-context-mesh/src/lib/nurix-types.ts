// Nurix / AgentX API types — ported from conversation-graph

export interface NurixUser {
  user_id: string
  workspace_id: string
  identifier_type: string
  identifier: string
  masked_identifier: string
  decrypted_identifier?: string
  user_metadata: Record<string, unknown> | null
  preferences: Record<string, unknown> | null
  is_active: boolean
  last_interaction_at: string | null
  created_at: string
}

export interface NurixAgent {
  agent_id: string
  agent_name: string
  type: string | null
  status: string | null
}

export interface NurixCallContext {
  conversation_summary?: string
  user_turn_count?: number
  agent_turn_count?: number
  hitl_reason?: string
  [key: string]: unknown
}

export interface NurixCallAdditionalInfo {
  lead_id?: string
  trunk_id?: string
  campaign_id?: string
  retry_count?: number
  custom_dynamic_variables_config?: {
    job_id?: number
    customer_name?: string
    partner_contact?: string
    customer_contact?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface NurixVoiceCall {
  call_id: string
  agent_id: string
  user_id: string
  workspace_id: string
  start_time: string
  end_time: string | null
  duration: number | null
  status: string
  direction: string
  call_end_reason: string | null
  human_transfer_status: string | null
  call_context: NurixCallContext | null
  additional_info: NurixCallAdditionalInfo | null
  recording_url: string | null
  transcript_url: string | null
  is_encrypted: boolean
  campaign_id: number | null
  lead_id: number | null
  trunk_phone_number: string | null
  user_phone_number: string | null
  created_at: string
}

export interface NurixRecentCallResponse {
  previous_call_ids: string[] | null
  previous_call_id: string | null
  previous_call_summary: string | null
}

export type Sentiment = 'positive' | 'neutral' | 'negative'
export type Outcome = 'completed' | 'dropped' | 'transferred' | 'follow_up_needed' | 'in_progress' | 'failed' | null
export type Intent = 'inquiry' | 'pricing' | 'complaint' | 'demo' | 'objection' | 'follow_up' | 'checkin' | 'checkout' | 'escalation' | 'unknown'

export interface ConversationEvent {
  id: string
  type: string
  channel: string
  timestamp: string
  intent: Intent
  sentiment: Sentiment
  outcome: Outcome
  agent_id: string
  agent_name: string
  duration?: number
  direction?: string
  transcript_snippet?: string
  call_end_reason?: string
  human_transfer_status?: string
  metadata?: Record<string, unknown>
}

export interface JourneyInsights {
  total_touchpoints: number
  entry_point: ConversationEvent | null
  drop_off_point: ConversationEvent | null
  conversion_point: ConversationEvent | null
  re_entry_point: ConversationEvent | null
  overall_sentiment: Sentiment
  journey_outcome: Outcome
  total_duration_seconds: number
  agents_involved: string[]
  date_range: { start: string; end: string }
}

export interface Journey {
  user_id: string
  phone_number: string
  customer_name: string | null
  workspace_id: string
  events: ConversationEvent[]
  insights: JourneyInsights
  enriched_at: string
}
