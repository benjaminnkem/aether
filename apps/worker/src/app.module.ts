import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MongoWorkerStore } from "./persistence/mongo-worker-store";
import {
  CHAIN_READER,
  HttpKeeperHubProvider,
  HttpSimulator,
  INVESTIGATION_ASSISTANT,
  JsonRpcChainReader,
  KEEPER_HUB,
  OpenAiInvestigationAssistant,
  SIMULATOR,
} from "./providers/providers";
import { WorkerRuntime } from "./worker-runtime";

@Module({
  imports: [
    MongooseModule.forRoot(required("MONGODB_URI"), {
      serverSelectionTimeoutMS: 5_000,
      autoIndex: process.env.NODE_ENV !== "production",
    }),
  ],
  providers: [
    MongoWorkerStore,
    JsonRpcChainReader,
    HttpSimulator,
    HttpKeeperHubProvider,
    OpenAiInvestigationAssistant,
    { provide: CHAIN_READER, useExisting: JsonRpcChainReader },
    { provide: SIMULATOR, useExisting: HttpSimulator },
    { provide: KEEPER_HUB, useExisting: HttpKeeperHubProvider },
    {
      provide: INVESTIGATION_ASSISTANT,
      useExisting: OpenAiInvestigationAssistant,
    },
    WorkerRuntime,
  ],
})
export class WorkerModule {}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
