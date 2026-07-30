import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MongoWorkerStore } from "./persistence/mongo-worker-store";
import {
  CHAIN_READER,
  GITHUB_PROVIDER,
  HttpGitHubProvider,
  HttpKeeperHubProvider,
  HttpSimulator,
  JsonRpcChainReader,
  KEEPER_HUB,
  MockChainReader,
  MockKeeperHubProvider,
  MockSimulator,
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
    { provide: GITHUB_PROVIDER, useExisting: HttpGitHubProvider },
    WorkerRuntime,
  ],
})
export class WorkerModule {}
