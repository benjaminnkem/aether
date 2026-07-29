"use client";

import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSend(trimmed);
      setValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    },
    [value, disabled, onSend]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, []);

  return (
    <div className="border-t border-border/50 bg-background/80 px-4 py-3 backdrop-blur-xl">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-3xl items-end gap-2"
      >
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            id="chat-message-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Describe your onchain intent…"
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-xl border border-input bg-muted/30 px-4 py-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring focus:ring-1 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/20"
            style={{ maxHeight: "160px" }}
          />
        </div>
        <Button
          id="chat-send-button"
          type="submit"
          size="icon-lg"
          disabled={disabled || !value.trim()}
          className="shrink-0 rounded-xl"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
          <span className="sr-only">Send message</span>
        </Button>
      </form>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted-foreground/50">
        Aether may produce inaccurate information. Always verify transactions before signing.
      </p>
    </div>
  );
}
