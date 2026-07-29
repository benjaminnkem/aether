"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { type Message } from "./types";

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "group flex w-full gap-3 px-4 py-3 transition-colors",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <Avatar size="sm" className="mt-0.5 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
            Æ
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          "relative max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted/60 text-foreground rounded-bl-md dark:bg-muted/40"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="whitespace-pre-wrap break-words">
            {message.content.split("\n").map((line, i) => (
              <p key={i} className={line === "" ? "h-2" : undefined}>
                {line ? renderInlineMarkdown(line) : null}
              </p>
            ))}
          </div>
        )}
        <span
          className={cn(
            "mt-1.5 block text-[10px] opacity-0 transition-opacity group-hover:opacity-60",
            isUser
              ? "text-primary-foreground/70 text-right"
              : "text-muted-foreground"
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {isUser && (
        <Avatar size="sm" className="mt-0.5 shrink-0">
          <AvatarFallback className="bg-foreground/10 text-foreground text-[10px] font-bold dark:bg-foreground/15">
            U
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
