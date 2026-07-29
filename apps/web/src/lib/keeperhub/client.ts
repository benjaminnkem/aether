import { type Intent } from "@/types/intent";
import { mapIntentToWorkflow } from "./workflow-mapper";
import {
  type Workflow,
  type SimulationResult,
  type ExecutionResult,
  type StatusResult,
} from "./types";

export class KeeperHubClient {
  private mcpUrl: string;
  private apiUrl: string;
  private apiKey?: string;

  constructor() {
    this.mcpUrl = process.env.KEEPERHUB_MCP_URL || "https://app.keeperhub.com/mcp";
    this.apiUrl = process.env.KEEPERHUB_API_URL || "https://app.keeperhub.com/api";
    this.apiKey = process.env.KEEPERHUB_API_KEY;
    console.log(`[KeeperHubClient] Initialized. MCP URL: ${this.mcpUrl}, API URL: ${this.apiUrl}, Key present: ${!!this.apiKey}`);
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private async callMcpTool(toolName: string, args: Record<string, any>): Promise<any> {
    const payload = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
      id: Math.floor(Math.random() * 1000000),
    };

    console.log(`[KeeperHubClient] Calling MCP tool "${toolName}" on ${this.mcpUrl}`);
    const response = await fetch(this.mcpUrl, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`MCP request failed with status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || `MCP Error: ${JSON.stringify(data.error)}`);
    }

    console.log(`[KeeperHubClient] MCP tool "${toolName}" succeeded`);
    return data.result;
  }

  async createWorkflowFromIntent(intent: Intent): Promise<Workflow> {
    const workflowDefinition = mapIntentToWorkflow(intent);
    console.log(`[KeeperHubClient] Creating workflow from intent: "${intent.originalText}"`);

    const importPayload = {
      version: 1,
      workflow: {
        name: workflowDefinition.name,
        description: workflowDefinition.description,
      },
      nodes: workflowDefinition.nodes,
      edges: workflowDefinition.edges,
      exportedAt: new Date().toISOString(),
      integrationBindings: [],
    };

    console.log(`[KeeperHubClient] Attempting REST workflow creation at ${this.apiUrl}/workflows/import`);
    const response = await fetch(`${this.apiUrl}/workflows/import`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(importPayload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[KeeperHubClient] REST API workflow creation failed. Status: ${response.status}. Response: ${text}`);
      throw new Error(`REST API workflow creation failed: ${response.statusText}`);
    }

    const data = await response.json();
    const workflow = data.workflow || data;
    console.log(`[KeeperHubClient] Workflow created via REST: ${workflow.id}`);
    return workflow;
  }

  async simulateWorkflow(workflowId: string): Promise<SimulationResult> {
    console.log(`[KeeperHubClient] Simulating workflow: ${workflowId}`);
    try {
      const mcpResult = await this.callMcpTool("simulate_workflow", {
        workflowId,
      });

      if (mcpResult) {
        console.log(`[KeeperHubClient] Simulation via MCP succeeded for ${workflowId}`);
        return {
          success: mcpResult.success ?? true,
          gasEstimated: mcpResult.gasEstimated,
          logs: mcpResult.logs,
          error: mcpResult.error,
        };
      }
    } catch (error) {
      console.warn("[KeeperHubClient] MCP simulation failed:", error);
    }

    console.log(`[KeeperHubClient] Attempting REST simulation at ${this.apiUrl}/workflows/${workflowId}/simulate`);
    const response = await fetch(`${this.apiUrl}/workflows/${workflowId}/simulate`, {
      method: "POST",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[KeeperHubClient] REST API simulation failed. Status: ${response.status}. Response: ${text}`);
      return {
        success: false,
        error: `REST API simulation failed: ${response.statusText}`,
      };
    }

    const data = await response.json();
    console.log(`[KeeperHubClient] Simulation via REST succeeded for ${workflowId}`);
    return {
      success: data.success ?? true,
      gasEstimated: data.gasEstimated || data.gasUsedWei,
      logs: data.logs,
      error: data.error,
    };
  }

  async executeWorkflow(workflowId: string): Promise<ExecutionResult> {
    console.log(`[KeeperHubClient] Executing workflow: ${workflowId}`);
    try {
      const mcpResult = await this.callMcpTool("execute_workflow", {
        workflowId,
      });

      if (mcpResult) {
        console.log(`[KeeperHubClient] Execution via MCP succeeded for ${workflowId}`);
        return {
          success: mcpResult.success ?? true,
          executionId: mcpResult.executionId,
          txHash: mcpResult.txHash,
          error: mcpResult.error,
        };
      }
    } catch (error) {
      console.warn("[KeeperHubClient] MCP execution failed:", error);
    }

    console.log(`[KeeperHubClient] Attempting REST execution at ${this.apiUrl}/workflows/${workflowId}/execute`);
    const response = await fetch(`${this.apiUrl}/workflows/${workflowId}/execute`, {
      method: "POST",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[KeeperHubClient] REST API execution failed. Status: ${response.status}. Response: ${text}`);
      return {
        success: false,
        error: `REST API execution failed: ${response.statusText}`,
      };
    }

    const data = await response.json();
    console.log(`[KeeperHubClient] Execution via REST succeeded for ${workflowId}`);
    return {
      success: data.success ?? true,
      executionId: data.executionId || data.id,
      txHash: data.txHash || data.transactionHash,
      error: data.error,
    };
  }

  async getWorkflowStatus(workflowId: string): Promise<StatusResult> {
    console.log(`[KeeperHubClient] Checking status of workflow: ${workflowId}`);
    try {
      const mcpResult = await this.callMcpTool("get_workflow_status", {
        workflowId,
      });

      if (mcpResult) {
        return {
          status: mcpResult.status,
          completedAt: mcpResult.completedAt,
          error: mcpResult.error,
          output: mcpResult.output,
        };
      }
    } catch (error) {
      console.warn("[KeeperHubClient] MCP status check failed:", error);
    }

    const response = await fetch(`${this.apiUrl}/workflows/${workflowId}/executions`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[KeeperHubClient] REST API status check failed. Status: ${response.status}. Response: ${text}`);
      throw new Error(`REST API status check failed: ${response.statusText}`);
    }

    const data = await response.json();
    const latestExecution = Array.isArray(data) ? data[0] : data;

    if (!latestExecution) {
      return { status: "pending" };
    }

    let status: StatusResult["status"] = "pending";
    if (latestExecution.completedAt) {
      status = latestExecution.error ? "failed" : "success";
    } else if (latestExecution.startedAt) {
      status = "running";
    }

    return {
      status,
      completedAt: latestExecution.completedAt,
      error: latestExecution.error,
      output: latestExecution.output,
    };
  }
}
