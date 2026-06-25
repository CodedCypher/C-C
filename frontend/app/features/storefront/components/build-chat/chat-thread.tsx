/**
 * The conversation transcript. User turns sit on the right, the assistant on the
 * left; an assistant turn that resolved a parts list embeds a ResolvedBuildCard.
 * Auto-scrolls to the newest message (and the "thinking" indicator while a reply
 * is in flight).
 */

import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";

import { assetUrl } from "~/lib/axios";
import type { BuildChatMessage } from "../../types/storefront.types";
import { ResolvedBuildCard } from "./resolved-build-card";

export function ChatThread({
  messages,
  pending,
}: {
  messages: BuildChatMessage[];
  pending: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Scroll the THREAD container only — `scrollIntoView` would scroll the page
  // too, yanking the header out of view on every send.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending]);

  return (
    <div
      ref={scrollRef}
      className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-6"
    >
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {pending && <ThinkingBubble />}
    </div>
  );
}

function MessageBubble({ message }: { message: BuildChatMessage }) {
  const isUser = message.role === "USER";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex size-8 shrink-0 items-center justify-center border-2 border-line ${
          isUser ? "bg-ink text-paper" : "bg-signal text-ink"
        }`}
      >
        {isUser ? (
          <User className="size-4" aria-hidden="true" />
        ) : (
          <Bot className="size-4" aria-hidden="true" />
        )}
      </div>
      <div
        className={`flex min-w-0 flex-col gap-3 ${
          isUser ? "items-end" : "items-start"
        } ${message.build ? "w-full" : "max-w-[85%]"}`}
      >
        {message.imageUrl && (
          <div className="overflow-hidden border-2 border-line shadow-brutal">
            <img
              src={assetUrl(message.imageUrl)}
              alt="Attached photo"
              className="max-h-64 w-auto max-w-full bg-paper-2 object-contain"
            />
          </div>
        )}
        {message.content && (
          <div
            className={`whitespace-pre-wrap border-2 border-line px-4 py-2.5 font-sans text-[0.9375rem] leading-[1.55] ${
              isUser ? "bg-ink text-paper" : "bg-paper text-ink shadow-brutal"
            }`}
          >
            {message.content}
          </div>
        )}
        {message.build && (
          <div className="w-full max-w-[34rem]">
            <ResolvedBuildCard build={message.build} />
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center border-2 border-line bg-signal text-ink">
        <Bot className="size-4" aria-hidden="true" />
      </div>
      <div className="flex items-center gap-1.5 border-2 border-line bg-paper px-4 py-3 shadow-brutal">
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 animate-bounce bg-ink"
      style={{ animationDelay: delay }}
    />
  );
}
