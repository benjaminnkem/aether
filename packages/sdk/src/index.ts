import axios, { type AxiosInstance } from "axios";
import {
  dashboardSchema,
  desiredStateSchema,
  scenarioSchema,
  type Dashboard,
  type DesiredState,
  type Scenario,
} from "@aether/shared";

declare const process: {
  env: Record<string, string | undefined>;
};

export interface AetherTransport {
  getDashboard(organizationId: string, protocolId: string): Promise<Dashboard>;
  setScenario(scenario: Scenario): Promise<Dashboard>;
  advanceLifecycle(): Promise<Dashboard>;
  approveOperation(decision: "approve" | "reject"): Promise<Dashboard>;
  validateDesiredState(input: DesiredState): Promise<DesiredState>;
}

export class AetherClient {
  private readonly http: AxiosInstance;
  private transport?: AetherTransport;

  constructor(baseURL = "/v1") {
    this.http = axios.create({
      baseURL,
      headers: { "X-Aether-Client": "web" },
      timeout: 10_000,
    });
  }

  setTransport(transport?: AetherTransport) {
    this.transport = transport;
  }

  async getDashboard(
    organizationId: string,
    protocolId = "arcadia",
  ): Promise<Dashboard> {
    if (this.transport) {
      return dashboardSchema.parse(
        await this.transport.getDashboard(organizationId, protocolId),
      );
    }
    const response = await this.http.get("/dashboard", {
      params: { organizationId, protocolId },
    });
    return dashboardSchema.parse(response.data);
  }

  async setScenario(scenario: Scenario): Promise<Dashboard> {
    const parsed = scenarioSchema.parse(scenario);
    if (this.transport) {
      return dashboardSchema.parse(await this.transport.setScenario(parsed));
    }
    const response = await this.http.post("/demo/scenario", {
      scenario: parsed,
    });
    return dashboardSchema.parse(response.data);
  }

  async advanceLifecycle(): Promise<Dashboard> {
    if (this.transport) {
      return dashboardSchema.parse(await this.transport.advanceLifecycle());
    }
    const response = await this.http.post("/demo/advance");
    return dashboardSchema.parse(response.data);
  }

  async approveOperation(decision: "approve" | "reject"): Promise<Dashboard> {
    if (this.transport) {
      return dashboardSchema.parse(
        await this.transport.approveOperation(decision),
      );
    }
    const response = await this.http.post(
      "/operations/op-oracle-restoration/approval",
      {
        decision,
      },
    );
    return dashboardSchema.parse(response.data);
  }

  async validateDesiredState(input: DesiredState): Promise<DesiredState> {
    const parsed = desiredStateSchema.parse(input);
    if (this.transport) {
      return desiredStateSchema.parse(
        await this.transport.validateDesiredState(parsed),
      );
    }
    const response = await this.http.post("/desired-state/validate", parsed);
    return desiredStateSchema.parse(response.data);
  }
}

export const aetherClient = new AetherClient(
  process.env.NEXT_PUBLIC_AETHER_API_URL ?? "/v1",
);
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
