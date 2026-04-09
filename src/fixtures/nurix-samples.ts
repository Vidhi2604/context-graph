// 8 realistic Nurix call transcripts for hackathon demo
// Coordinated with HubSpot + Zendesk test data (same phone/email)

export const NURIX_SAMPLE_CALLS = [
  // ── Call 1: Priya — Return escalation (links to HubSpot + Zendesk via phone) ──
  {
    call_id: "nurix_call_001",
    caller_phone: "9876543210",
    agent_name: "Ravi K.",
    agent_id: "agent_ravi_001",
    duration_seconds: 247,
    sentiment: "frustrated → resolved",
    transcript: `Agent: Hi, thank you for calling. How can I help you today?
Customer: I ordered Nike Air Max last month and the size is too small. I want to return it. My order was cash on delivery.
Agent: I understand. Let me check your order. I see it's been 35 days — our policy is 30 days but since you're a Gold member, I'll approve the return.
Customer: Thank you, I appreciate that.
Agent: I'll process your refund within 48 hours to your original payment method.
Customer: Perfect. Thank you for the help.`,
    entities: {
      customer_name: "Priya Mehta",
      email: "priya@testmail.com",
      issue_type: "return_request",
      resolution: "exception_approved",
      promise: "Refund within 48 hours",
    },
  },

  // ── Call 2: Priya — Follow-up, commitment breach ──
  {
    call_id: "nurix_call_002",
    caller_phone: "9876543210",
    agent_name: "Anita S.",
    agent_id: "agent_anita_001",
    duration_seconds: 183,
    sentiment: "frustrated",
    transcript: `Agent: Hi, thank you for calling. How can I assist?
Customer: I called 3 days ago about a return and was promised a refund in 48 hours. It's been 72 hours and nothing.
Agent: I sincerely apologize for the delay. Let me escalate this immediately.
Customer: This is unacceptable. I've been waiting.
Agent: I completely understand your frustration. I'm escalating to our senior team right now and you'll receive the refund within 24 hours — I'm personally marking this as priority.`,
    entities: {
      customer_name: "Priya Mehta",
      email: "priya@testmail.com",
      issue_type: "refund_followup",
      resolution: "escalated",
      promise: "Refund within 24 hours — priority escalation",
    },
  },

  // ── Call 3: Amit — AI resolved, positive ──
  {
    call_id: "nurix_call_003",
    caller_phone: "9123456789",
    agent_name: "Deepak M.",
    agent_id: "agent_deepak_001",
    duration_seconds: 95,
    sentiment: "neutral → satisfied",
    transcript: `Agent: Hi! Thanks for calling. What can I help you with today?
Customer: I wanted to check the delivery status for my recent order.
Agent: Sure! I can see your order — it's out for delivery today and should arrive by 6 PM.
Customer: Great, thank you!
Agent: Is there anything else I can help you with?
Customer: No, that's all. Thanks!`,
    entities: {
      customer_name: "Amit Kumar",
      email: "amit@testmail.com",
      issue_type: "delivery_inquiry",
      resolution: "resolved",
      promise: null,
    },
  },

  // ── Call 4: Kavita — COD wrong item ──
  {
    call_id: "nurix_call_004",
    caller_phone: "9876543216",
    agent_name: "Ravi K.",
    agent_id: "agent_ravi_001",
    duration_seconds: 312,
    sentiment: "angry → partially resolved",
    transcript: `Agent: Thank you for calling. How may I help you?
Customer: I received the wrong item! I ordered a Fossil Watch but got a random backpack. This is completely unacceptable.
Agent: I'm so sorry about this error. Let me pull up your order right away.
Customer: I paid cash on delivery too. I want my watch or a full refund immediately.
Agent: Absolutely. I'm arranging a pickup for the wrong item and I'll ship the correct watch with express delivery. You'll receive it within 2 business days. No additional payment needed.
Customer: Okay, but this better not happen again.`,
    entities: {
      customer_name: "Kavita Reddy",
      email: "kavita@testmail.com",
      issue_type: "wrong_item",
      resolution: "replacement_arranged",
      promise: "Correct item delivered in 2 business days",
    },
  },

  // ── Call 5: Various — Loyalty complaint ──
  {
    call_id: "nurix_call_005",
    caller_phone: "9876543211",
    agent_name: "Priya R.",
    agent_id: "agent_priya_r_001",
    duration_seconds: 220,
    sentiment: "disappointed → neutral",
    transcript: `Agent: Hi, thanks for calling! How can I assist?
Customer: I've been a Gold member for 2 years but I feel like my loyalty isn't being rewarded. New customers get better discounts.
Agent: I completely hear you. Your loyalty means a lot to us. Let me see what I can do.
Customer: I just want to feel valued.
Agent: I'm going to apply a 15% loyalty discount to your next 3 orders. Additionally, I'm noting your feedback for our loyalty team.
Customer: That's something, I suppose. Thank you.`,
    entities: {
      customer_name: "Rahul Sharma",
      email: "rahul@testmail.com",
      issue_type: "loyalty_complaint",
      resolution: "discount_applied",
      promise: "15% discount on next 3 orders",
    },
  },

  // ── Call 6: Dropped call — churn risk ──
  {
    call_id: "nurix_call_006",
    caller_phone: "9876543219",
    agent_name: null,
    agent_id: null,
    duration_seconds: 28,
    sentiment: "frustrated",
    transcript: `Customer: I've called 4 times about my missing order and nobody has resolved—
[Call disconnected]`,
    entities: {
      customer_name: "Suresh Nair",
      email: "suresh@testmail.com",
      issue_type: "missing_order",
      resolution: "unresolved",
      promise: null,
    },
  },

  // ── Call 7: Repeat escalation — high churn risk ──
  {
    call_id: "nurix_call_007",
    caller_phone: "9876543213",
    agent_name: "Vikram T.",
    agent_id: "agent_vikram_001",
    duration_seconds: 445,
    sentiment: "very frustrated → resolved",
    transcript: `Agent: Hi, I'm Vikram, a senior manager. I understand you've had a difficult experience.
Customer: This is my fourth call. Nobody has helped me. My order was supposed to arrive 2 weeks ago.
Agent: I sincerely apologize. Looking at your account, I can see there were 3 failed delivery attempts. I'm personally ensuring your order is delivered tomorrow morning with priority handling.
Customer: I want some compensation for this inconvenience.
Agent: Absolutely fair. I'm crediting 500 loyalty points to your account and adding a free express delivery for your next 5 orders.
Customer: Fine. But this is the last chance.`,
    entities: {
      customer_name: "Arjun Patel",
      email: "arjun@testmail.com",
      issue_type: "missing_order",
      resolution: "priority_delivery_compensation",
      promise: "Delivery tomorrow morning + 500 points + 5 free express deliveries",
    },
  },

  // ── Call 8: Healthcare — Dr. Sharma patient post-discharge ──
  {
    call_id: "nurix_call_008",
    caller_phone: "9123456790",
    agent_name: "Dr. Sharma",
    agent_id: "dr_sharma_001",
    duration_seconds: 380,
    sentiment: "concerned → reassured",
    transcript: `Dr. Sharma: Hello, this is Dr. Sharma calling to check on Suresh after his discharge.
Patient: Hello Doctor. I've been having some chest discomfort since yesterday.
Dr. Sharma: I see. That can sometimes happen post-procedure. Let me ask — is it worse when you breathe or constant?
Patient: It's more constant, not too severe but concerning.
Dr. Sharma: I want you to come in for a follow-up tomorrow morning. Please don't exert yourself. If it gets worse tonight, go directly to the emergency department.
Patient: Should I be worried?
Dr. Sharma: It's likely nothing serious, but I want to check to be safe. I'm scheduling you for 10 AM tomorrow.`,
    entities: {
      customer_name: "Suresh Reddy",
      email: "suresh.r@testmail.com",
      issue_type: "post_discharge_symptoms",
      resolution: "follow_up_scheduled",
      promise: "Follow-up appointment at 10 AM tomorrow",
    },
  },
];
