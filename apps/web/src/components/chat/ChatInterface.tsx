"use client";

import { useState, useCallback } from "react";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { type Message } from "./types";
import { formatIntentResponse } from "@/lib/agent/format-intent";
import { type Intent } from "@/types/intent";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface IntentApiResponse {
  success: boolean;
  intent?: Intent;
  error?: string;
  details?: { path: string; message: string }[];
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });

      const data: IntentApiResponse = await res.json();

      let assistantContent: string;

      if (data.success && data.intent) {
        assistantContent = formatIntentResponse(data.intent);
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
    } catch {
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content:
          "Something went wrong while connecting to the server. Please check your connection and try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
