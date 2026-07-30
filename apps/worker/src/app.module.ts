import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MongoWorkerStore } from "./persistence/mongo-worker-store";
import {
  CHAIN_READER,
  GITHUB_PROVIDER,
  HttpGitHubProvider,
  HttpKeeperHubProvider,
  HttpSimulator,
  INVESTIGATION_ASSISTANT,
  JsonRpcChainReader,
  KEEPER_HUB,
  MockChainReader,
  MockGitHubProvider,
  MockInvestigationAssistant,
  MockKeeperHubProvider,
  MockSimulator,
  OpenAiInvestigationAssistant,
  SIMULATOR,
} from "./providers/providers";
import { WorkerRuntime } from "./worker-runtime";

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/aether",
      {
        serverSelectionTimeoutMS: 5_000,
        autoIndex: process.env.NODE_ENV !== "production",
      },
    ),
  ],
  providers: [
    MongoWorkerStore,
    MockChainReader,
    MockSimulator,
    MockKeeperHubProvider,
    MockGitHubProvider,
    MockInvestigationAssistant,
    HttpGitHubProvider,
    {
      provide: CHAIN_READER,
      useFactory: () =>
        process.env.AETHER_PROVIDER_MODE === "live"
          ? new JsonRpcChainReader()
          : new MockChainReader(),
    },
    {
      provide: SIMULATOR,
      useFactory: () =>
        process.env.AETHER_PROVIDER_MODE === "live"
          ? new HttpSimulator()
          : new MockSimulator(),
    },
    {
      provide: KEEPER_HUB,
      useFactory: () =>
        process.env.AETHER_PROVIDER_MODE === "live"
          ? new HttpKeeperHubProvider()
          : new MockKeeperHubProvider(),
    },
    {
      provide: GITHUB_PROVIDER,
      useFactory: () =>
        process.env.AETHER_PROVIDER_MODE === "live"
          ? new HttpGitHubProvider()
          : new MockGitHubProvider(),
    },
    {
      provide: INVESTIGATION_ASSISTANT,
      useFactory: () =>
        process.env.AETHER_PROVIDER_MODE === "live" &&
        process.env.AETHER_OPENAI_ENABLED === "true"
          ? new OpenAiInvestigationAssistant()
          : new MockInvestigationAssistant(),
    },
    WorkerRuntime,
  ],
})
export class WorkerModule {}
