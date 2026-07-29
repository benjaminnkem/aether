"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { MessageBubble } from "./MessageBubble";
import { type Message } from "./types";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Empty className="border-none">
          <EmptyHeader>
            <EmptyMedia>
              <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 dark:from-primary/15 dark:to-primary/5">
                <span className="font-heading text-2xl font-bold text-primary">Æ</span>
              </div>
            </EmptyMedia>
            <EmptyTitle className="text-base">
              What would you like to do onchain?
            </EmptyTitle>
            <EmptyDescription>
              Send a swap, bridge, stake, or any other onchain intent.
              <br />
              Aether will figure out the rest.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-1 py-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="flex w-full gap-3 px-4 py-3">
            <Avatar size="sm" className="mt-0.5 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                Æ
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted/60 px-4 py-3 dark:bg-muted/40">
              <Spinner className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Thinking…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
