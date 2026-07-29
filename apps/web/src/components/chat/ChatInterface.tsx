"use client";

import { useState, useCallback } from "react";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { type Message } from "./types";
import { formatIntentResponse, formatSimulationSummary } from "@/lib/agent/format-intent";
import { type Intent } from "@/types/intent";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface PendingWorkflowState {
  id: string;
  intent: Intent;
  simulation: {
    success: boolean;
    gasEstimated: string;
    logs: string[];
  };
}

interface ExecuteApiResponse {
  success: boolean;
  intent?: Intent;
  workflowId?: string;
  simulation?: {
    success: boolean;
    gasEstimated: string;
    logs: string[];
  };
  execution?: {
    success: boolean;
    txHash?: string;
    error?: string;
  };
  error?: string;
  details?: { path: string; message: string }[];
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingWorkflow, setPendingWorkflow] = useState<PendingWorkflowState | null>(null);

  const handleSend = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const inputLower = content.trim().toLowerCase();
    const isConfirm = ["yes", "y", "confirm", "execute", "go", "approve", "proceed"].includes(inputLower);
    const isCancel = ["no", "n", "cancel", "stop", "discard"].includes(inputLower);

    try {
      if (pendingWorkflow && (isConfirm || isCancel)) {
        if (isConfirm) {
          const res = await fetch("/api/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "execute", workflowId: pendingWorkflow.id }),
          });

          const data: ExecuteApiResponse = await res.json();

          let assistantContent: string;
          if (data.success && data.execution) {
            assistantContent = `⚡ **Transaction Executed Successfully!**\n\nThe workflow has been submitted via KeeperHub.\n\n• **Transaction Hash:** \`${data.execution.txHash || "0x0000000000000000000000000000000000000000"}\`\n• **Status:** Confirmed`;
          } else {
            assistantContent = `❌ **Execution Failed:** ${data.error ?? "An unknown error occurred during execution."}`;
          }

          const assistantMessage: Message = {
            id: generateId(),
            role: "assistant",
            content: assistantContent,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else {
          const assistantMessage: Message = {
            id: generateId(),
            role: "assistant",
            content: "❌ **Action Cancelled.**\n\nThe pending workflow has been discarded. Let me know what else you would like to do.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
        setPendingWorkflow(null);
      } else {
        if (pendingWorkflow) {
          setPendingWorkflow(null);
        }

        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "parse-and-simulate", message: content }),
        });

        const data: ExecuteApiResponse = await res.json();

        let assistantContent: string;

        if (data.success && data.intent) {
          if (data.intent.requireConfirmation) {
            assistantContent = formatSimulationSummary(
              data.intent,
              data.simulation?.gasEstimated ?? "0.0015 ETH"
            );
            setPendingWorkflow({
              id: data.workflowId || "",
              intent: data.intent,
              simulation: data.simulation || { success: true, gasEstimated: "0.0015 ETH", logs: [] },
            });
          } else {
            const execRes = await fetch("/api/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "execute", workflowId: data.workflowId }),
            });

            const execData: ExecuteApiResponse = await execRes.json();

            if (execData.success && execData.execution) {
              const intentSummary = formatIntentResponse(data.intent);
              assistantContent = `${intentSummary}\n\n⚡ **Transaction Executed Automatically:**\n• **Transaction Hash:** \`${execData.execution.txHash}\``;
            } else {
              assistantContent = `❌ **Automatic Execution Failed:** ${execData.error ?? "An unknown error occurred."}`;
            }
          }
        } else {
          assistantContent = data.details
            ? `I had trouble understanding that. ${data.details.map((d) => d.message).join(". ")}`
            : `Sorry, I couldn't parse that intent. ${data.error ?? "Please try rephrasing your request."}`;
        }

        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: assistantContent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (e) {
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: `Something went wrong: ${e instanceof Error ? e.message : "Connection failed."}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [pendingWorkflow]);

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border/50 bg-background/80 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70">
            <span className="font-heading text-sm font-bold text-primary-foreground">
              Æ
            </span>
          </div>
          <div>
            <h1 className="font-heading text-sm font-semibold tracking-tight">
              Aether
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Speak any onchain intent
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
            <div className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              Online
            </span>
          </div>
        </div>
      </header>

      <MessageList messages={messages} isLoading={isLoading} />

      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
