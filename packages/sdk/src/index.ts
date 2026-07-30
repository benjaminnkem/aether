import axios, { type AxiosInstance } from "axios";
import {
  dashboardSchema,
  desiredStateSchema,
  scenarioSchema,
  type Dashboard,
  type DesiredState,
  type Scenario,
} from "@aether/shared";

export class AetherClient {
  private readonly http: AxiosInstance;

  constructor(baseURL = "/v1") {
    this.http = axios.create({
      baseURL,
      headers: { "X-Aether-Client": "web" },
      timeout: 10_000,
    });
  }

  async getDashboard(organizationId: string, protocolId = "arcadia"): Promise<Dashboard> {
    const response = await this.http.get("/dashboard", {
      params: { organizationId, protocolId },
    });
    return dashboardSchema.parse(response.data);
  }

  async setScenario(scenario: Scenario): Promise<Dashboard> {
    const response = await this.http.post("/demo/scenario", {
      scenario: scenarioSchema.parse(scenario),
    });
    return dashboardSchema.parse(response.data);
  }

  async advanceLifecycle(): Promise<Dashboard> {
    const response = await this.http.post("/demo/advance");
    return dashboardSchema.parse(response.data);
  }

  async approveOperation(decision: "approve" | "reject"): Promise<Dashboard> {
    const response = await this.http.post("/operations/op-oracle/approval", { decision });
    return dashboardSchema.parse(response.data);
  }

  async validateDesiredState(input: DesiredState): Promise<DesiredState> {
    const parsed = desiredStateSchema.parse(input);
    const response = await this.http.post("/desired-state/validate", parsed);
    return desiredStateSchema.parse(response.data);
  }
}

export const aetherClient = new AetherClient("/v1");
export const queryKeys = {
  dashboard: (organizationId: string, protocolId: string) =>
    ["dashboard", organizationId, protocolId] as const,
};
export interface RealtimeEvent {
  id: string;
  type: "dashboard.updated" | "operation.progress";
  sequence: number;
  createdAt: string;
}
export interface RealtimeAdapter {
  subscribe(listener: (event: RealtimeEvent) => void): () => void;
}
