"use client";

import { useState, useCallback } from "react";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { type Message } from "./types";

/** Mock responses for demo purposes */
const MOCK_RESPONSES = [
  "I can help you with that! Let me analyze the best route for your transaction. I'll check multiple DEXes for optimal pricing and minimal slippage.",
  "Looking into that now. I've found a few options across Uniswap, Curve, and 1inch. The most efficient route would save you approximately 0.3% on fees.",
  "Great question! To execute this onchain, you'll need to approve the token first, then I'll prepare the transaction for you to sign. Want me to proceed?",
  "I've prepared the transaction details. The estimated gas cost is ~0.002 ETH at current prices. Ready when you are!",
  "Done! I've queued up the transaction. You can track its status in the activity panel once it's been signed and submitted to the network.",
];

let mockIndex = 0;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback((content: string) => {
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate assistant response
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: MOCK_RESPONSES[mockIndex % MOCK_RESPONSES.length],
        timestamp: new Date(),
      };
      mockIndex++;
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, delay);
  }, []);

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Header */}
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

      {/* Messages */}
      <MessageList messages={messages} isLoading={isLoading} />

      {/* Input */}
      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
