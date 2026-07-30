import {
  arcadiaMarketAbi,
  chainObservationSchema,
  chainLogSchema,
  chainReceiptSchema,
  arcadiaSelectors,
  encodeSetOracleCalldata,
  githubCommitSchema,
  githubPullRequestSchema,
  githubReleaseSchema,
  githubRepositorySchema,
  investigationInputSchema,
  investigationSuggestionSchema,
  keeperStepLogsSchema,
  keeperStatusSchema,
  keeperSubmissionSchema,
  providerHealthSchema,
  redact,
  simulationResultSchema,
  verificationResultSchema,
  type ChainReader,
  type GitHubProvider,
  type InvestigationAssistant,
  type InvestigationInput,
  type KeeperHubProvider,
  type ProviderHealth,
  type Simulator,
  type TransactionRequest,
} from "@aether/backend";
import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { ProviderRuntime } from "./provider-runtime";

export const CHAIN_READER = Symbol("CHAIN_READER");
export const SIMULATOR = Symbol("SIMULATOR");
export const KEEPER_HUB = Symbol("KEEPER_HUB");
export const GITHUB_PROVIDER = Symbol("GITHUB_PROVIDER");
export const INVESTIGATION_ASSISTANT = Symbol("INVESTIGATION_ASSISTANT");

const approvedOracle = "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311";
const blockHash = `0x${"1".repeat(64)}`;
const transactionHash = `0x${"7".repeat(64)}`;

function mockHealth(provider: ProviderHealth["provider"]): ProviderHealth {
  return providerHealthSchema.parse({
    provider,
    status: "healthy",
    checkedAt: "2026-07-30T00:00:00.000Z",
    latencyMs: 0,
    consecutiveFailures: 0,
    detail: "Deterministic mock provider.",
  });
}

@Injectable()
export class MockChainReader implements ChainReader {
  getHealth() {
    return mockHealth("evm-rpc");
  }

  async observeOracle(chainId: number, contract: string, blockNumber?: number) {
    return chainObservationSchema.parse({
      chainId,
      contract,
      blockNumber: blockNumber ?? 17_924_118,
      blockHash,
      oracle: approvedOracle,
      oracleUpdatedAt: 1_800_000_000,
      fresh: true,
      canonical: true,
      observedAt: new Date().toISOString(),
    });
  }

  async verifyOracle(
    request: TransactionRequest,
    minimumConfirmations: number,
    _transactionHash?: string,
  ) {
    void _transactionHash;
    return verificationResultSchema.parse({
      verified: true,
      oracle: request.desiredOracle,
      oracleUpdatedAt: 1_800_000_000,
      fresh: true,
      blockNumber: 17_924_130,
      blockHash,
      confirmations: minimumConfirmations,
      canonical: true,
      providerCorrelationId: "rpc-verify-mock",
    });
  }

  async getLogs() {
    return [];
  }

  async getReceipt(
    _chainId: number,
    requestedTransactionHash: string,
    minimumConfirmations: number,
  ) {
    return chainReceiptSchema.parse({
      transactionHash: requestedTransactionHash,
      blockNumber: 17_924_125,
      blockHash,
      success: true,
      confirmations: minimumConfirmations,
      canonical: true,
      logs: [],
    });
  }
}

@Injectable()
export class MockSimulator implements Simulator {
  getHealth() {
    return mockHealth("keeperhub");
  }

  async simulate(
    planHash: string,
    _request: TransactionRequest,
    blockNumber: number,
  ) {
    return simulationResultSchema.parse({
      simulationId: `sim-${planHash.slice(2, 10)}`,
      planHash,
      success: true,
      gasEstimate: "284211",
      postconditionMatched: true,
      blockNumber,
    });
  }
}

@Injectable()
export class MockKeeperHubProvider implements KeeperHubProvider {
  getHealth() {
    return mockHealth("keeperhub");
  }

  async submit(
    idempotencyKey: string,
    planHash: string,
    request: TransactionRequest,
  ) {
    void planHash;
    void request;
    return keeperSubmissionSchema.parse({
      workflowId: `KH-${idempotencyKey.slice(0, 8)}`,
      providerCorrelationId: idempotencyKey,
      status: "submitted",
      transactionHash,
    });
  }

  async reconcile(providerCorrelationId: string, workflowId?: string) {
    return keeperStatusSchema.parse({
      workflowId: workflowId ?? `KH-${providerCorrelationId.slice(0, 8)}`,
      providerCorrelationId,
      status: "confirmed",
      transactionHash,
      blockNumber: 17_924_125,
      confirmations: 12,
    });
  }

  async getStepLogs(workflowId: string) {
    return keeperStepLogsSchema.parse([
      {
        logId: "mock-log-submit",
        workflowId,
        stepId: "write-oracle",
        stepName: "Set approved oracle",
        stepType: "web3/write-contract",
        status: "success",
        transactionHash,
        startedAt: "2026-07-30T00:00:00.000Z",
        completedAt: "2026-07-30T00:00:01.000Z",
        durationMs: 1_000,
        evidence: { mode: "mock", redacted: true },
      },
    ]);
  }
}

const jsonRpcEnvelopeSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});
const rpcBlockSchema = z.object({
  hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  number: z.string().regex(/^0x[a-fA-F0-9]+$/),
});
const rpcLogSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  blockNumber: z.string().regex(/^0x[a-fA-F0-9]+$/),
  blockHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  logIndex: z.string().regex(/^0x[a-fA-F0-9]+$/),
  topics: z.array(z.string().regex(/^0x[a-fA-F0-9]{64}$/)),
  data: z.string().regex(/^0x[a-fA-F0-9]*$/),
  removed: z.boolean().optional().default(false),
});
const rpcReceiptSchema = z.object({
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  blockHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  blockNumber: z.string().regex(/^0x[a-fA-F0-9]+$/),
  status: z.enum(["0x0", "0x1"]),
  logs: z.array(rpcLogSchema).optional().default([]),
});

export class ReorgDetectedError extends Error {
  constructor() {
    super("Pinned block hash changed while reading postconditions.");
    this.name = "ReorgDetectedError";
  }
}

export class UnknownReceiptOutcomeError extends Error {
  constructor() {
    super(
      "Transaction receipt is not yet available; submission must not be retried.",
    );
    this.name = "UnknownReceiptOutcomeError";
  }
}

export class FinalityPendingError extends Error {
  constructor(readonly confirmations: number) {
    super(`Only ${confirmations} confirmations are available.`);
    this.name = "FinalityPendingError";
  }
}

@Injectable()
export class JsonRpcChainReader implements ChainReader {
  private readonly rpcUrl: string;
  private readonly readCalldata: string;
  private readonly runtime = new ProviderRuntime({ provider: "evm-rpc" });

  constructor() {
    this.rpcUrl = required("AETHER_RPC_URL");
    this.readCalldata =
      process.env.AETHER_ORACLE_READ_CALLDATA ?? arcadiaSelectors.oracleStatus;
  }

  getHealth() {
    return this.runtime.getHealth();
  }

  private async rpc(method: string, params: unknown[]): Promise<unknown> {
    const envelope = jsonRpcEnvelopeSchema.parse(
      await this.runtime.json(this.rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        idempotent: true,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params,
        }),
      }),
    );
    if (envelope.error || envelope.result === undefined) {
      throw new Error(`RPC ${method} returned a validated error response.`);
    }
    return envelope.result;
  }

  private async rpcString(method: string, params: unknown[]): Promise<string> {
    return z.string().parse(await this.rpc(method, params));
  }

  private async blockByTag(tag: string) {
    return rpcBlockSchema.parse(
      await this.rpc("eth_getBlockByNumber", [tag, false]),
    );
  }

  private async assertChain(chainId: number) {
    const providerChainId = Number.parseInt(
      await this.rpcString("eth_chainId", []),
      16,
    );
    if (providerChainId !== chainId) {
      throw new Error(
        `RPC chain mismatch: expected ${chainId}, received ${providerChainId}.`,
      );
    }
  }

  async observeOracle(chainId: number, contract: string, blockNumber?: number) {
    await this.assertChain(chainId);
    const blockTag = blockNumber
      ? `0x${blockNumber.toString(16)}`
      : await this.rpcString("eth_blockNumber", []);
    const blockBefore = await this.blockByTag(blockTag);
    const encoded = await this.rpcString("eth_call", [
      { to: contract, data: this.readCalldata },
      blockTag,
    ]);
    const blockAfter = await this.blockByTag(blockTag);
    if (blockAfter.hash.toLowerCase() !== blockBefore.hash.toLowerCase()) {
      throw new ReorgDetectedError();
    }
    const words = encoded.replace(/^0x/, "").match(/.{64}/g);
    if (!words || words.length < 3) {
      throw new Error("oracleStatus() returned malformed ABI data.");
    }
    const oracle = `0x${words[0]!.slice(-40)}`;
    const oracleUpdatedAt = Number(BigInt(`0x${words[1]!}`));
    const fresh = BigInt(`0x${words[2]!}`) === 1n;
    return chainObservationSchema.parse({
      chainId,
      blockNumber: Number.parseInt(blockBefore.number, 16),
      blockHash: blockBefore.hash,
      contract,
      oracle,
      oracleUpdatedAt,
      fresh,
      canonical: true,
      observedAt: new Date().toISOString(),
    });
  }

  async getLogs(input: {
    chainId: number;
    address: string;
    fromBlock: number;
    toBlock: number;
    topics?: string[];
  }) {
    await this.assertChain(input.chainId);
    if (input.toBlock < input.fromBlock) {
      throw new Error("Log range must not move backwards.");
    }
    const rawLogs = z.array(rpcLogSchema).parse(
      await this.rpc("eth_getLogs", [
        {
          address: input.address,
          fromBlock: `0x${input.fromBlock.toString(16)}`,
          toBlock: `0x${input.toBlock.toString(16)}`,
          ...(input.topics ? { topics: input.topics } : {}),
        },
      ]),
    );
    return rawLogs.map((log) =>
      chainLogSchema.parse({
        ...log,
        blockNumber: Number.parseInt(log.blockNumber, 16),
        logIndex: Number.parseInt(log.logIndex, 16),
      }),
    );
  }

  async getReceipt(
    chainId: number,
    requestedTransactionHash: string,
    minimumConfirmations: number,
  ) {
    await this.assertChain(chainId);
    const receiptResult = await this.rpc("eth_getTransactionReceipt", [
      requestedTransactionHash,
    ]);
    if (receiptResult === null) return undefined;
    const receipt = rpcReceiptSchema.parse(receiptResult);
    const head = Number.parseInt(
      await this.rpcString("eth_blockNumber", []),
      16,
    );
    const receiptBlock = Number.parseInt(receipt.blockNumber, 16);
    const confirmations = Math.max(0, head - receiptBlock + 1);
    if (confirmations < minimumConfirmations) {
      throw new FinalityPendingError(confirmations);
    }
    const canonicalReceiptBlock = await this.blockByTag(receipt.blockNumber);
    const canonical =
      canonicalReceiptBlock.hash.toLowerCase() ===
      receipt.blockHash.toLowerCase();
    if (!canonical) throw new ReorgDetectedError();
    return chainReceiptSchema.parse({
      transactionHash: receipt.transactionHash,
      blockNumber: receiptBlock,
      blockHash: receipt.blockHash,
      success: receipt.status === "0x1",
      confirmations,
      canonical,
      logs: receipt.logs.map((log) => ({
        ...log,
        blockNumber: Number.parseInt(log.blockNumber, 16),
        logIndex: Number.parseInt(log.logIndex, 16),
      })),
    });
  }

  async verifyOracle(
    request: TransactionRequest,
    minimumConfirmations: number,
    transactionHash?: string,
  ) {
    if (!transactionHash) {
      throw new UnknownReceiptOutcomeError();
    }
    const receipt = await this.getReceipt(
      request.chainId,
      transactionHash,
      minimumConfirmations,
    );
    if (!receipt) throw new UnknownReceiptOutcomeError();
    if (!receipt.success) {
      throw new Error("Confirmed transaction reverted.");
    }
    const head = Number.parseInt(
      await this.rpcString("eth_blockNumber", []),
      16,
    );
    const observation = await this.observeOracle(
      request.chainId,
      request.target,
      head,
    );
    return verificationResultSchema.parse({
      verified:
        observation.oracle.toLowerCase() ===
          request.desiredOracle.toLowerCase() &&
        observation.fresh &&
        observation.canonical,
      oracle: observation.oracle,
      oracleUpdatedAt: observation.oracleUpdatedAt,
      fresh: observation.fresh,
      blockNumber: observation.blockNumber,
      blockHash: observation.blockHash,
      confirmations: receipt.confirmations,
      canonical: observation.canonical,
      providerCorrelationId: `rpc-${observation.blockHash.slice(2, 14)}`,
    });
  }
}

@Injectable()
export class HttpKeeperHubProvider implements KeeperHubProvider {
  private readonly baseUrl = required("KEEPERHUB_BASE_URL").replace(/\/$/, "");
  private readonly token = required("KEEPERHUB_API_TOKEN");
  private readonly workflowId = required("KEEPERHUB_WORKFLOW_ID");
  private readonly runtime = new ProviderRuntime({ provider: "keeperhub" });

  getHealth() {
    return this.runtime.getHealth();
  }

  async submit(
    idempotencyKey: string,
    planHash: string,
    request: TransactionRequest,
  ) {
    const raw = unwrapData(
      await this.runtime.json(
        `${this.baseUrl}/workflows/${encodeURIComponent(this.workflowId)}/execute`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.token}`,
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
            "x-request-id": idempotencyKey.slice(0, 128),
          },
          body: JSON.stringify({
            input: {
              clientCorrelationId: idempotencyKey,
              planHash,
              exactRequest: request,
            },
          }),
        },
      ),
    );
    const response = z
      .object({
        executionId: z.string().min(1),
        status: z.enum(["pending", "running", "success", "error", "cancelled"]),
        transactionHashes: z
          .array(
            z.object({
              hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
            }),
          )
          .optional(),
      })
      .parse(raw);
    return keeperSubmissionSchema.parse({
      workflowId: response.executionId,
      providerCorrelationId: idempotencyKey,
      status:
        response.status === "error" || response.status === "cancelled"
          ? "unknown"
          : response.status === "success"
            ? "submitted"
            : "accepted",
      transactionHash: response.transactionHashes?.[0]?.hash,
    });
  }

  async reconcile(providerCorrelationId: string, workflowId?: string) {
    if (!workflowId) {
      return keeperStatusSchema.parse({
        workflowId: "unresolved",
        providerCorrelationId,
        status: "unknown",
      });
    }
    const raw = unwrapData(
      await this.runtime.json(
        `${this.baseUrl}/workflows/executions/${encodeURIComponent(
          workflowId,
        )}/status`,
        {
          headers: {
            authorization: `Bearer ${this.token}`,
            "x-request-id": providerCorrelationId.slice(0, 128),
          },
        },
      ),
    );
    const status = keeperExecutionStatusResponseSchema.parse(raw);
    const transactions = status.transactionHashes?.map((item) => ({
      hash: item.hash,
      stepId: item.nodeId,
      stepName: item.nodeName,
      chainId: item.chainId,
    }));
    const mappedStatus =
      status.status === "success"
        ? "confirmed"
        : status.status === "error" || status.status === "cancelled"
          ? "failed"
          : "pending";
    return keeperStatusSchema.parse({
      workflowId,
      providerCorrelationId,
      status: mappedStatus,
      transactionHash: transactions?.at(-1)?.hash,
      transactions,
      steps: status.nodeStatuses?.map((step) => ({
        stepId: step.nodeId,
        stepName: step.nodeName ?? step.nodeId,
        status: step.status === "error" ? "failed" : step.status,
      })),
    });
  }

  async getStepLogs(workflowId: string) {
    const raw = unwrapData(
      await this.runtime.json(
        `${this.baseUrl}/workflows/executions/${encodeURIComponent(
          workflowId,
        )}/logs`,
        { headers: { authorization: `Bearer ${this.token}` } },
      ),
    );
    const response = keeperExecutionLogsResponseSchema.parse(raw);
    return keeperStepLogsSchema.parse(
      response.logs.map((log) => ({
        logId: log.id,
        workflowId,
        stepId: log.nodeId,
        stepName: log.nodeName,
        stepType: log.nodeType,
        status: log.status === "error" ? "failed" : log.status,
        transactionHash:
          typeof log.output?.transactionHash === "string"
            ? log.output.transactionHash
            : undefined,
        error: log.error ?? undefined,
        startedAt: log.startedAt ?? undefined,
        completedAt: log.completedAt ?? undefined,
        durationMs: log.duration ? Number(log.duration) : undefined,
        evidence: redactProviderEvidence(log.output),
      })),
    );
  }
}

@Injectable()
export class HttpSimulator implements Simulator {
  private readonly baseUrl = required("KEEPERHUB_BASE_URL").replace(/\/$/, "");
  private readonly token = required("KEEPERHUB_API_TOKEN");
  private readonly runtime = new ProviderRuntime({ provider: "keeperhub" });

  getHealth() {
    return this.runtime.getHealth();
  }

  async simulate(
    planHash: string,
    request: TransactionRequest,
    blockNumber: number,
  ) {
    const response = keeperSimulationResponseSchema.parse(
      unwrapData(
        await this.runtime.json(`${this.baseUrl}/execute/contract-call`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.token}`,
            "content-type": "application/json",
            "x-request-id": `sim-${planHash.slice(2, 34)}`,
          },
          idempotent: true,
          acceptedStatuses: [400],
          body: JSON.stringify(keeperExactCallBody(request, true)),
        }),
      ),
    );
    return simulationResultSchema.parse({
      simulationId: `keeperhub-sim-${planHash.slice(2, 14)}`,
      planHash,
      success: response.success && !response.wouldRevert,
      gasEstimate: response.gasEstimate ?? "0",
      postconditionMatched: response.success && !response.wouldRevert,
      blockNumber,
      errorCode: response.wouldRevert ? "KEEPERHUB_WOULD_REVERT" : undefined,
    });
  }
}

@Injectable()
export class MockGitHubProvider implements GitHubProvider {
  getHealth() {
    return mockHealth("github");
  }

  async getRepository(repository: string) {
    return githubRepositorySchema.parse({
      repository,
      defaultBranch: "main",
      url: `https://github.com/${repository}`,
      visibility: "public",
      archived: false,
      pushedAt: "2026-07-30T00:00:00.000Z",
    });
  }

  async getRelease(repository: string, tag: string) {
    return githubReleaseSchema.parse({
      repository,
      tag,
      commitSha: "a".repeat(40),
      url: `https://github.com/${repository}/releases/tag/${tag}`,
      publishedAt: "2026-07-30T00:00:00.000Z",
    });
  }

  async getCommit(repository: string, reference: string) {
    return githubCommitSchema.parse({
      repository,
      commitSha: /^[a-f0-9]{40}$/i.test(reference) ? reference : "a".repeat(40),
      url: `https://github.com/${repository}/commit/${"a".repeat(40)}`,
      message: "Release Arcadia v2.4.2",
      authoredAt: "2026-07-30T00:00:00.000Z",
      verified: true,
    });
  }

  async getPullRequest(repository: string, number: number) {
    return githubPullRequestSchema.parse({
      repository,
      number,
      url: `https://github.com/${repository}/pull/${number}`,
      state: "closed",
      merged: true,
      headCommitSha: "a".repeat(40),
      baseCommitSha: "b".repeat(40),
      updatedAt: "2026-07-30T00:00:00.000Z",
    });
  }
}

@Injectable()
export class HttpGitHubProvider implements GitHubProvider {
  private readonly token = process.env.GITHUB_READ_TOKEN;
  private readonly runtime = new ProviderRuntime({ provider: "github" });

  getHealth() {
    return this.runtime.getHealth();
  }

  async getRepository(repository: string) {
    const raw = githubRepositoryResponseSchema.parse(
      await this.github(repository, ""),
    );
    return githubRepositorySchema.parse({
      repository,
      defaultBranch: raw.default_branch,
      url: raw.html_url,
      visibility: raw.visibility,
      archived: raw.archived,
      pushedAt: raw.pushed_at,
    });
  }

  async getRelease(repository: string, tag: string) {
    const raw = githubReleaseResponseSchema.parse(
      await this.github(
        repository,
        `/releases/tags/${encodeURIComponent(tag)}`,
      ),
    );
    const commit = await this.getCommit(repository, raw.tag_name);
    return githubReleaseSchema.parse({
      repository,
      tag: raw.tag_name,
      commitSha: commit.commitSha,
      url: raw.html_url,
      publishedAt: raw.published_at,
    });
  }

  async getCommit(repository: string, reference: string) {
    const raw = githubCommitResponseSchema.parse(
      await this.github(
        repository,
        `/commits/${encodeURIComponent(reference)}`,
      ),
    );
    return githubCommitSchema.parse({
      repository,
      commitSha: raw.sha,
      url: raw.html_url,
      message: raw.commit.message,
      authoredAt: raw.commit.author.date,
      verified: raw.commit.verification.verified,
    });
  }

  async getPullRequest(repository: string, number: number) {
    const raw = githubPullRequestResponseSchema.parse(
      await this.github(repository, `/pulls/${number}`),
    );
    const baseCommit = await this.getCommit(repository, raw.base.sha);
    return githubPullRequestSchema.parse({
      repository,
      number: raw.number,
      url: raw.html_url,
      state: raw.state,
      merged: raw.merged,
      headCommitSha: raw.head.sha,
      baseCommitSha: baseCommit.commitSha,
      updatedAt: raw.updated_at,
    });
  }

  private async github(repository: string, suffix: string) {
    const [owner, name, ...extra] = repository.split("/");
    if (!owner || !name || extra.length > 0) {
      throw new Error("GitHub repository must be owner/name.");
    }
    return this.runtime.json(
      `https://api.github.com/repos/${encodeURIComponent(
        owner,
      )}/${encodeURIComponent(name)}${suffix}`,
      {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "aether-worker",
          "x-github-api-version": "2022-11-28",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
      },
    );
  }
}

@Injectable()
export class MockInvestigationAssistant implements InvestigationAssistant {
  getHealth() {
    return mockHealth("openai");
  }

  async suggest(input: InvestigationInput) {
    const parsed = investigationInputSchema.parse(input);
    return investigationSuggestionSchema.parse({
      summary:
        "Observed oracle evidence differs from the approved desired-state address.",
      evidenceReferences: parsed.observedFacts.map(
        (_fact, index) => `${parsed.findingId}:observed:${index + 1}`,
      ),
      suggestedPlan: {
        chainId: parsed.allowedChainIds[0],
        target: parsed.allowedTargets[0],
        functionSignature: parsed.allowedFunctions[0],
        desiredOracle: extractAddress(parsed.desiredStateFacts),
        rationale:
          "Suggest restoring the desired oracle for deterministic review and simulation.",
      },
      advisoryOnly: true,
    });
  }
}

@Injectable()
export class OpenAiInvestigationAssistant implements InvestigationAssistant {
  private readonly apiKey = required("OPENAI_API_KEY");
  private readonly model = process.env.OPENAI_MODEL ?? "gpt-5.6-sol";
  private readonly runtime = new ProviderRuntime({ provider: "openai" });

  getHealth() {
    return this.runtime.getHealth();
  }

  async suggest(input: InvestigationInput) {
    const parsed = investigationInputSchema.parse(input);
    const raw = openAiResponseSchema.parse(
      await this.runtime.json("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          store: false,
          input: [
            {
              role: "system",
              content:
                "Summarize supplied evidence and optionally suggest only the typed setOracle plan. You have no authority to approve, change policy, sign, execute, or declare success.",
            },
            { role: "user", content: JSON.stringify(parsed) },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "aether_investigation_suggestion",
              strict: true,
              schema: z.toJSONSchema(investigationSuggestionSchema),
            },
          },
        }),
      }),
    );
    const outputText = raw.output
      .flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text")?.text;
    if (!outputText) throw new Error("OpenAI returned no structured output.");
    return investigationSuggestionSchema.parse(JSON.parse(outputText));
  }
}

const keeperTransactionSchema = z.object({
  hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  nodeId: z.string().min(1),
  nodeName: z.string().min(1),
  chainId: z.number().int().positive().optional(),
});

const keeperExecutionStatusResponseSchema = z.object({
  status: z.enum(["pending", "running", "success", "error", "cancelled"]),
  nodeStatuses: z
    .array(
      z.object({
        nodeId: z.string().min(1),
        nodeName: z.string().min(1).optional(),
        status: z.enum(["pending", "running", "success", "error", "cancelled"]),
      }),
    )
    .optional(),
  transactionHashes: z.array(keeperTransactionSchema).optional(),
});

const keeperExecutionLogsResponseSchema = z.object({
  logs: z.array(
    z.object({
      id: z.string().min(1),
      nodeId: z.string().min(1),
      nodeName: z.string().min(1),
      nodeType: z.string().min(1),
      status: z.enum(["pending", "running", "success", "error", "cancelled"]),
      output: z.record(z.string(), z.unknown()).nullish(),
      error: z.string().nullish(),
      duration: z.string().regex(/^\d+$/).nullish(),
      startedAt: z.string().datetime().nullish(),
      completedAt: z.string().datetime().nullish(),
    }),
  ),
});

const keeperSimulationResponseSchema = z.object({
  success: z.boolean(),
  status: z.literal("simulated"),
  gasEstimate: z.string().regex(/^\d+$/).optional(),
  wouldRevert: z.boolean(),
  revertReason: z.string().optional(),
  error: z.string().optional(),
});

const githubRepositoryResponseSchema = z.object({
  default_branch: z.string().min(1),
  html_url: z.string().url(),
  visibility: z.enum(["public", "private", "internal"]),
  archived: z.boolean(),
  pushed_at: z.string().datetime(),
});

const githubReleaseResponseSchema = z.object({
  tag_name: z.string().min(1),
  target_commitish: z.string().min(1),
  html_url: z.string().url(),
  published_at: z.string().datetime(),
});

const githubCommitResponseSchema = z.object({
  sha: z.string().regex(/^[a-f0-9]{40}$/i),
  html_url: z.string().url(),
  commit: z.object({
    message: z.string().min(1),
    author: z.object({ date: z.string().datetime() }),
    verification: z.object({ verified: z.boolean() }),
  }),
});

const githubPullRequestResponseSchema = z.object({
  number: z.number().int().positive(),
  html_url: z.string().url(),
  state: z.enum(["open", "closed"]),
  merged: z.boolean(),
  head: z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/i) }),
  base: z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/i) }),
  updated_at: z.string().datetime(),
});

const openAiResponseSchema = z.object({
  output: z.array(
    z.object({
      content: z
        .array(
          z.object({
            type: z.string(),
            text: z.string().optional(),
          }),
        )
        .optional(),
    }),
  ),
});

function unwrapData(value: unknown): unknown {
  const envelope = z.object({ data: z.unknown() }).safeParse(value);
  return envelope.success ? envelope.data.data : value;
}

function keeperExactCallBody(request: TransactionRequest, simulate: boolean) {
  if (
    request.calldata.toLowerCase() !==
    encodeSetOracleCalldata(request.desiredOracle).toLowerCase()
  ) {
    throw new Error(
      "KeeperHub request calldata does not match the typed setOracle arguments.",
    );
  }
  return {
    contractAddress: request.target,
    chainId: request.chainId,
    functionName: "setOracle",
    functionArgs: JSON.stringify([request.desiredOracle]),
    abi: JSON.stringify(arcadiaMarketAbi),
    value: request.valueWei,
    simulate,
  };
}

function redactProviderEvidence(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return (redact(value ?? {}) ?? {}) as Record<string, unknown>;
}

function extractAddress(facts: string[]): string {
  for (const fact of facts) {
    const address = fact.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (address) return address;
  }
  throw new Error("Desired-state evidence did not contain an EVM address.");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required in live provider mode.`);
  return value;
}
