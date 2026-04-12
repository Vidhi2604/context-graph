import { VerticalConfig } from "@/types/vertical";

export const retailVertical: VerticalConfig = {
  id: "retail",
  name: "Retail",
  description: "E-commerce event tracking and decision intelligence",

  nodeTypes: [
    {
      label: "Profile",
      displayName: "name",
      icon: "👤",
      properties: [
        { name: "profile_id", type: "string", unique: true },
        { name: "name", type: "string" },
        { name: "tier", type: "string", enum: ["Bronze", "Silver", "Gold", "Platinum"] },
        { name: "city", type: "string" },
        { name: "ltv", type: "float" },
      ],
    },
    {
      label: "Event",
      displayName: "event_type",
      icon: "📦",
      properties: [
        { name: "id", type: "string", unique: true },
        { name: "event_type", type: "string" },
        { name: "timestamp", type: "datetime" },
        { name: "status", type: "string" },
        { name: "amount", type: "float" },
        { name: "channel", type: "string" },
        { name: "exception", type: "boolean" },
        { name: "confidence_score", type: "float" },
      ],
    },
    {
      label: "Product",
      displayName: "name",
      icon: "🏷️",
      properties: [
        { name: "product_id", type: "string", unique: true },
        { name: "name", type: "string" },
        { name: "category", type: "string", enum: ["Footwear", "Apparel", "Accessories"] },
        { name: "brand", type: "string" },
        { name: "price", type: "float" },
      ],
    },
    {
      label: "Policy",
      displayName: "name",
      icon: "📋",
      properties: [
        { name: "policy_id", type: "string", unique: true },
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "rule_summary", type: "string" },
        { name: "status", type: "string", enum: ["active", "superseded", "revoked"] },
      ],
    },
    {
      label: "Agent",
      displayName: "name",
      icon: "🧑‍💼",
      properties: [
        { name: "agent_id", type: "string", unique: true },
        { name: "name", type: "string" },
        { name: "role", type: "string" },
        { name: "team", type: "string" },
      ],
    },
    {
      label: "Payment",
      displayName: "method",
      icon: "💳",
      properties: [
        { name: "payment_id", type: "string", unique: true },
        { name: "method", type: "string", enum: ["COD", "UPI", "Credit Card", "Debit Card"] },
        { name: "amount", type: "float" },
        { name: "status", type: "string" },
      ],
    },
    {
      label: "Outcome",
      displayName: "type",
      icon: "📊",
      properties: [
        { name: "outcome_id", type: "string", unique: true },
        { name: "type", type: "string" },
        { name: "value", type: "float" },
        { name: "description", type: "string" },
      ],
    },
    {
      label: "Commitment",
      displayName: "promise_text",
      icon: "🤝",
      properties: [
        { name: "commitment_id", type: "string", unique: true },
        { name: "promise_text", type: "string" },
        { name: "deadline", type: "datetime" },
        { name: "status", type: "string", enum: ["open", "fulfilled", "breached", "cancelled"] },
        { name: "assignee", type: "string" },
      ],
    },
  ],

  colors: {
    Profile: "#10b981",
    Identity: "#6b7280",
    Event: "#3b82f6",
    Product: "#8b5cf6",
    Session: "#6366f1",
    Policy: "#eab308",
    Agent: "#14b8a6",
    Payment: "#f97316",
    Outcome: "#ef4444",
    Commitment: "#ec4899",
  },

  filters: [
    { id: "tier", label: "Tier", type: "select", options: ["Bronze", "Silver", "Gold", "Platinum"], cypherField: "p.tier" },
    { id: "city", label: "City", type: "select", options: ["Bangalore", "Mumbai", "Delhi", "Chennai", "Hyderabad"], cypherField: "p.city" },
    { id: "category", label: "Category", type: "select", options: ["Footwear", "Apparel", "Accessories"], cypherField: "prod.category" },
    { id: "payment", label: "Payment", type: "select", options: ["COD", "UPI", "Credit Card", "Debit Card"], cypherField: "e.payment_method" },
    { id: "status", label: "Status", type: "select", options: ["completed", "pending", "exception", "denied"], cypherField: "e.status" },
    { id: "dateRange", label: "Date Range", type: "date", cypherField: "e.timestamp" },
  ],

  sampleQueries: [
    "Gold tier returns in Bangalore",
    "COD orders above 5000",
    "Nike return rate vs Puma",
    "shoes category last 7 days",
    "checkout dropoffs",
    "breached commitments last 30 days",
  ],

  constraints: [
    "CREATE CONSTRAINT profile_id IF NOT EXISTS FOR (p:Profile) REQUIRE p.profile_id IS UNIQUE",
    "CREATE CONSTRAINT identity_id IF NOT EXISTS FOR (i:Identity) REQUIRE i.identity_id IS UNIQUE",
    "CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE",
    "CREATE CONSTRAINT product_id IF NOT EXISTS FOR (p:Product) REQUIRE p.product_id IS UNIQUE",
    "CREATE CONSTRAINT policy_id IF NOT EXISTS FOR (p:Policy) REQUIRE p.policy_id IS UNIQUE",
    "CREATE CONSTRAINT agent_id IF NOT EXISTS FOR (a:Agent) REQUIRE a.agent_id IS UNIQUE",
    "CREATE CONSTRAINT payment_id IF NOT EXISTS FOR (p:Payment) REQUIRE p.payment_id IS UNIQUE",
    "CREATE CONSTRAINT outcome_id IF NOT EXISTS FOR (o:Outcome) REQUIRE o.outcome_id IS UNIQUE",
    "CREATE CONSTRAINT commitment_id IF NOT EXISTS FOR (c:Commitment) REQUIRE c.commitment_id IS UNIQUE",
  ],

  indexes: [
    "CREATE INDEX profile_tenant IF NOT EXISTS FOR (p:Profile) ON (p._tenant)",
    "CREATE INDEX profile_name IF NOT EXISTS FOR (p:Profile) ON (p.name)",
    "CREATE INDEX identity_lookup IF NOT EXISTS FOR (i:Identity) ON (i.type, i.value, i._tenant)",
    "CREATE INDEX identity_value IF NOT EXISTS FOR (i:Identity) ON (i.value)",
    "CREATE INDEX event_type IF NOT EXISTS FOR (e:Event) ON (e.event_type)",
    "CREATE INDEX event_timestamp IF NOT EXISTS FOR (e:Event) ON (e.timestamp)",
    "CREATE INDEX event_status IF NOT EXISTS FOR (e:Event) ON (e.status)",
    "CREATE INDEX product_category IF NOT EXISTS FOR (p:Product) ON (p.category)",
    "CREATE INDEX product_brand IF NOT EXISTS FOR (p:Product) ON (p.brand)",
    "CREATE INDEX payment_method IF NOT EXISTS FOR (p:Payment) ON (p.method)",
    "CREATE INDEX policy_status IF NOT EXISTS FOR (p:Policy) ON (p.status)",
  ],
};
