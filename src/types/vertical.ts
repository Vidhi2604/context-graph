export interface PropertyConfig {
  name: string;
  type: "string" | "integer" | "float" | "boolean" | "datetime";
  unique?: boolean;
  enum?: string[];
}

export interface NodeTypeConfig {
  label: string;
  properties: PropertyConfig[];
  displayName: string;
  icon: string;
}

export interface FilterConfig {
  id: string;
  label: string;
  type: "select" | "range" | "date";
  options?: string[];
  cypherField: string;
}

export interface VerticalConfig {
  id: string;
  name: string;
  description: string;
  nodeTypes: NodeTypeConfig[];
  colors: Record<string, string>;
  filters: FilterConfig[];
  sampleQueries: string[];
  constraints: string[];
  indexes: string[];
}
