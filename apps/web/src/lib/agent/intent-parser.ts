import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { IntentSchema, type Intent } from "@/types/intent";
import { INTENT_SYSTEM_PROMPT } from "./prompts";

let _model: ChatGoogleGenerativeAI | null = null;

function getModel(): ChatGoogleGenerativeAI {
  if (!_model) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_API_KEY is not set. Add it to your .env.local file.",
      );
    }

    _model = new ChatGoogleGenerativeAI({
      model: "gemini-3.5-flash-lite",
      apiKey,
      temperature: 0,
      maxOutputTokens: 1024,
    });
  }
  return _model;
}

export async function parseIntent(userMessage: string): Promise<Intent> {
  if (!userMessage.trim()) {
    throw new Error("Cannot parse an empty message.");
  }

  const model = getModel();

  const structuredModel = model.withStructuredOutput(IntentSchema, {
    name: "parse_onchain_intent",
  });

  const result = await structuredModel.invoke([
    new SystemMessage(INTENT_SYSTEM_PROMPT),
    new HumanMessage(userMessage),
  ]);

  const parsed = IntentSchema.parse({
    ...result,
    originalText: userMessage,
  });

  return parsed;
}
