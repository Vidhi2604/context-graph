import type { Journey, ConversationEvent } from './nurix-types'
import type { GraphResult, GraphNode, GraphEdge } from '@/types/graph'

const SENTIMENT_COLOR: Record<string, string> = {
  positive: '#10b981',
  neutral:  '#6b7280',
  negative: '#ef4444',
}

const OUTCOME_ICON: Record<string, string> = {
  completed:        '✓',
  transferred:      '↗',
  dropped:          '✕',
  follow_up_needed: '!',
  in_progress:      '…',
  failed:           '✗',
}

export function journeyToGraph(journey: Journey): GraphResult {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  // Profile node
  const profileId = `profile_${journey.user_id}`
  nodes.push({
    id: profileId,
    label: 'Profile',
    displayName: journey.customer_name || journey.phone_number,
    relevance: 1.0,
    properties: {
      phone: journey.phone_number,
      name: journey.customer_name || '',
      user_id: journey.user_id,
      total_calls: journey.events.length,
      overall_sentiment: journey.insights.overall_sentiment,
      agents_involved: journey.insights.agents_involved.join(', '),
      journey_outcome: journey.insights.journey_outcome || '',
    },
  })

  // Call event nodes
  journey.events.forEach((event: ConversationEvent, i: number) => {
    const nodeId = `call_${event.id}`
    const direction = event.direction?.toLowerCase() === 'outbound' ? 'OB' : 'IB'
    const transferred = event.human_transfer_status === 'COMPLETED' ? ' · Transferred' : ''
    const duration = event.duration ? `${Math.round(event.duration / 60)}m` : ''

    nodes.push({
      id: nodeId,
      label: 'Event',
      displayName: `${direction} · ${event.agent_name}${transferred}`,
      relevance: 0.8,
      properties: {
        event_type: event.intent,
        timestamp: event.timestamp,
        agent: event.agent_name,
        direction,
        duration: event.duration || 0,
        duration_formatted: duration,
        sentiment: event.sentiment,
        outcome: event.outcome || '',
        transferred: event.human_transfer_status === 'COMPLETED',
        call_end_reason: event.call_end_reason || '',
        summary: event.transcript_snippet || '',
        status: `${OUTCOME_ICON[event.outcome || ''] || ''} ${event.outcome || ''}`.trim(),
        color: SENTIMENT_COLOR[event.sentiment] || '#6b7280',
      },
    })

    edges.push({
      id: `e_profile_${i}`,
      source: profileId,
      target: nodeId,
      label: 'HAD_CALL',
      properties: {},
    })

    // Chain events
    if (i > 0) {
      edges.push({
        id: `e_chain_${i}`,
        source: `call_${journey.events[i - 1].id}`,
        target: nodeId,
        label: 'NEXT',
        properties: {},
      })
    }
  })

  // Build timeline
  const timeline = journey.events.map((e: ConversationEvent) => ({
    date: e.timestamp.slice(0, 10),
    events: [{
      id: `call_${e.id}`,
      label: 'Event',
      displayName: `${e.direction?.toLowerCase() === 'outbound' ? 'OB' : 'IB'} · ${e.agent_name}`,
      relevance: 0.8,
      properties: e as unknown as Record<string, unknown>,
    }],
  }))

  return {
    nodes,
    edges,
    timeline,
    centerNodeId: profileId,
    summary: {
      total_nodes: nodes.length,
      total_edges: edges.length,
      profile_count: 1,
      event_count: journey.events.length,
    },
  }
}

export function isPhoneNumber(query: string): boolean {
  const cleaned = query.trim().replace(/[\s\-\(\)]/g, '')
  return /^(\+91|91|0)?[6-9]\d{9}$/.test(cleaned) || /^\+?[\d]{10,13}$/.test(cleaned)
}
