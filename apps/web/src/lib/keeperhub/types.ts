export interface WorkflowNode {
  id: string;
  type: "trigger" | "action";
  position: { x: number; y: number };
  data: {
    type: "trigger" | "action";
    label: string;
    config: Record<string, any>;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt?: string;
}

export interface SimulationResult {
  success: boolean;
  error?: string;
  gasEstimated?: string;
  logs?: string[];
}

export interface ExecutionResult {
  success: boolean;
  executionId?: string;
  txHash?: string;
  error?: string;
}

export interface StatusResult {
  status: "pending" | "running" | "success" | "failed";
  completedAt?: string;
  error?: string;
  output?: Record<string, any>;
}
