/**
 * circuit.rocks — Build assistant (public route /build, and /build/$chatId for a
 * saved conversation). The old one-shot intake form is now a centralized chat:
 * the maker talks through WHAT to build, the assistant answers in three modes
 * (Brainstorm / Grill / Perfect), and when a parts list is ready it resolves it
 * inline — reusing the same matcher → SavedBuild pipeline as before — into an
 * addable card right in the thread. Conversations persist; a history rail on the
 * left lists them.
 */

import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { MessageSquarePlus, Sparkles, Trash2 } from "lucide-react";

import {
  useBuildChat,
  useBuildChats,
  useDeleteBuildChat,
  useSendBuildChat,
} from "../hooks/use-storefront";
import { ChatThread } from "../components/build-chat/chat-thread";
import {
  ChatComposer,
  type ComposerInput,
} from "../components/build-chat/chat-composer";

const STARTERS = [
  "I want to build a weather station",
  "Suggest a beginner Arduino project under ₱2000",
  "Help me pick parts for a smart plant monitor",
];

export function BuildChatPage() {
  const params = useParams({ strict: false }) as { chatId?: string };
  const chatId = params.chatId;
  const navigate = useNavigate();

  const chatsQuery = useBuildChats();
  const chatQuery = useBuildChat(chatId);
  const send = useSendBuildChat();
  const del = useDeleteBuildChat();

  // The just-sent turn, shown immediately so the maker sees their own message
  // before the (non-streaming) reply lands. Cleared once the turn settles, by
  // which point the real messages are in the chat cache.
  const [pendingUser, setPendingUser] = useState<string | null>(null);

  const messages = chatQuery.data?.messages ?? [];
  const threadMessages =
    pendingUser != null
      ? [
          ...messages,
          {
            id: "__pending__",
            role: "USER" as const,
            content: pendingUser,
            build: null,
            createdAt: "",
          },
        ]
      : messages;
  const showWelcome = threadMessages.length === 0 && !send.isPending;

  function handleSend(input: ComposerInput) {
    setPendingUser(
      input.text ??
        (input.url
          ? `[link] ${input.url}`
          : input.image
            ? `[photo] ${input.image.name}`
            : ""),
    );
    send.mutate(
      { chatId, mode: "BRAINSTORM", ...input },
      {
        onSuccess: (res) => {
          if (!chatId) {
            navigate({
              to: "/build/$chatId",
              params: { chatId: res.chat.id },
            });
          }
        },
        onSettled: () => setPendingUser(null),
      },
    );
  }

  function handleDelete(id: string) {
    del.mutate(id, {
      onSuccess: () => {
        if (id === chatId) navigate({ to: "/build" });
      },
    });
  }

  const chats = chatsQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-[1140px] flex-col px-6 py-8">
      <header className="flex flex-col gap-2 border-b-2 border-line pb-6">
        <span className="font-mono text-[0.75rem] uppercase tracking-[0.08em] text-smoke">
          // build assistant
        </span>
        <h1 className="font-sans text-[2rem] font-bold leading-[1.05] tracking-[-0.02em] text-ink">
          Tell me what you want to build
        </h1>
        <p className="max-w-[64ch] text-[0.9375rem] leading-[1.6] text-smoke">
          Chat through your idea — I'll suggest projects, pressure-test the plan,
          and turn the parts into an in-stock cart. Paste a list, snap a photo, or
          drop a tutorial link any time.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[15rem_1fr]">
        {/* History rail */}
        <aside className="hidden flex-col gap-2 lg:flex">
          <Link
            to="/build"
            className="flex items-center gap-2 border-2 border-line bg-ink px-3 py-2 font-mono text-[0.75rem] font-bold uppercase tracking-[0.06em] text-paper shadow-brutal"
          >
            <MessageSquarePlus className="size-4" aria-hidden="true" />
            New chat
          </Link>
          <div className="flex flex-col gap-1.5">
            {chats.map((c) => {
              const active = c.id === chatId;
              return (
                <div
                  key={c.id}
                  className={`group flex items-center gap-2 border-2 border-line px-3 py-2 ${
                    active ? "bg-signal" : "bg-paper hover:bg-paper-2"
                  }`}
                >
                  <Link
                    to="/build/$chatId"
                    params={{ chatId: c.id }}
                    className="flex min-w-0 flex-1 flex-col"
                  >
                    <span className="truncate font-sans text-[0.8125rem] font-semibold text-ink">
                      {c.title}
                    </span>
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.06em] text-smoke">
                      {c.messageCount} msg
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    aria-label="Delete chat"
                    className="shrink-0 text-smoke opacity-0 transition-opacity hover:text-soldout group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            })}
            {chats.length === 0 && (
              <p className="px-1 py-2 font-mono text-[0.6875rem] text-smoke">
                // your chats appear here
              </p>
            )}
          </div>
        </aside>

        {/* Main panel */}
        <section className="flex h-[70vh] min-h-[560px] flex-col border-2 border-line bg-paper shadow-brutal">
          {showWelcome ? (
            <WelcomePanel onPick={(text) => handleSend({ text })} />
          ) : (
            <ChatThread messages={threadMessages} pending={send.isPending} />
          )}
          {send.isError && (
            <p className="border-t-2 border-soldout bg-paper px-4 py-2 font-mono text-[0.75rem] text-soldout">
              // The assistant is busy right now — try again in a moment.
            </p>
          )}
          <ChatComposer onSend={handleSend} pending={send.isPending} />
        </section>
      </div>
    </div>
  );
}

function WelcomePanel({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-10 text-center">
      <div className="flex size-14 items-center justify-center border-2 border-line bg-signal shadow-brutal">
        <Sparkles className="size-6 text-ink" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-sans text-[1.25rem] font-bold text-ink">
          What are we building today?
        </h2>
        <p className="max-w-[42ch] text-[0.875rem] leading-[1.6] text-smoke">
          Describe an idea, or pick a starting point. Paste a parts list, snap a
          photo, or drop a tutorial link any time.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {STARTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="border-2 border-line bg-paper px-4 py-2.5 font-sans text-[0.875rem] text-ink shadow-brutal transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
