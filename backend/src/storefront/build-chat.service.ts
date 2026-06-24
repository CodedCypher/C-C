import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { fieldError } from '../common/structured-error';
import {
  BuildChatMode,
  type BuildChatRole,
} from '../generated/prisma/client';
import { matcherNotConfigured } from './part-matcher';
import { BuildChatLlmService } from './build-chat-llm.service';
import { systemPrompt } from './build-chat.prompts';
import type { ChatMessage } from './chat-completer';
import {
  StorefrontService,
  type BuildDetail,
  type ResolveBuildInput,
} from './storefront.service';

/* ------------------------------------------------------------------ *
 * Public response shapes (parsed 1:1 by the frontend zod schemas)
 * ------------------------------------------------------------------ */

export interface BuildChatSummary {
  id: string;
  title: string;
  mode: BuildChatMode;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface BuildChatMessageDto {
  id: string;
  role: BuildChatRole;
  content: string;
  /** Set when an assistant turn resolved a parts list → rendered inline. */
  build: BuildDetail | null;
  createdAt: string;
}

export interface BuildChatDetail extends BuildChatSummary {
  messages: BuildChatMessageDto[];
}

export interface SendBuildChatResult {
  chat: BuildChatSummary;
  userMessage: BuildChatMessageDto;
  assistantMessage: BuildChatMessageDto;
  /** The build the assistant resolved this turn, if any (also on assistantMessage). */
  build: BuildDetail | null;
}

const DEFAULT_TITLE = 'New build chat';
const HISTORY_TURNS = 20; // recent turns sent to the model (token budget)

const chatSummarySelect = {
  id: true,
  title: true,
  mode: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ChatSummaryRow = {
  id: string;
  title: string;
  mode: BuildChatMode;
  createdAt: Date;
  updatedAt: Date;
  _count?: { messages: number };
};

type MessageRow = {
  id: string;
  role: BuildChatRole;
  content: string;
  createdAt: Date;
};

/**
 * Orchestrates the build-assistant conversation. Deliberately kept OUT of the
 * already-large StorefrontService: it owns the chat/message tables and the LLM
 * turn, and REUSES StorefrontService for the heavy lifting it shouldn't duplicate
 * — `resolveBuild` (matcher + SavedBuild persistence) and `getBuild` (re-resolve
 * with fresh stock). Chat ownership mirrors SavedBuild exactly: a signed-in maker
 * owns by userId, a guest by the `cr_cart` session token.
 */
@Injectable()
export class BuildChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: BuildChatLlmService,
    private readonly storefront: StorefrontService,
  ) {}

  /** True when at least one chat provider is configured. */
  get enabled(): boolean {
    return this.llm.enabled;
  }

  /* ------------------------------- Reads ------------------------------- */

  /** The caller's chats (newest first); works for guests via the cart cookie. */
  async listChats(
    token: string | undefined,
    userId?: string,
  ): Promise<BuildChatSummary[]> {
    const owner = this.ownerWhere(token, userId);
    if (!owner) return [];
    const rows = await this.prisma.buildChat.findMany({
      where: owner,
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { ...chatSummarySelect, _count: { select: { messages: true } } },
    });
    return rows.map((r) => this.toSummary(r));
  }

  /** One chat with its full message log; inline builds re-resolved for fresh stock. */
  async getChat(
    id: string,
    token: string | undefined,
    userId?: string,
  ): Promise<BuildChatDetail> {
    const owner = this.ownerWhere(token, userId);
    const chat = owner
      ? await this.prisma.buildChat.findFirst({
          where: { id, ...owner },
          select: {
            ...chatSummarySelect,
            _count: { select: { messages: true } },
            messages: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                role: true,
                content: true,
                buildId: true,
                createdAt: true,
              },
            },
          },
        })
      : null;
    if (!chat) throw this.notFound();

    // Hydrate each distinct inline build once (a build can be referenced once).
    const builds = new Map<string, BuildDetail>();
    for (const m of chat.messages) {
      if (m.buildId && !builds.has(m.buildId)) {
        try {
          builds.set(m.buildId, await this.storefront.getBuild(m.buildId));
        } catch {
          /* build was deleted — render the message without a card */
        }
      }
    }

    return {
      ...this.toSummary(chat),
      messages: chat.messages.map((m) =>
        this.toMessageDto(m, m.buildId ? builds.get(m.buildId) ?? null : null),
      ),
    };
  }

  /* ------------------------------ Writes ------------------------------ */

  /**
   * Append one maker turn and produce the assistant's reply. Lazy-creates the chat
   * on the first message. Photo/link turns route straight to the resolver; text
   * turns go through the LLM, which can itself trigger a resolve via its envelope.
   * Returns the (possibly newly minted) owner token so the controller can set the
   * `cr_cart` cookie — keeping chat, builds and cart under one owner.
   */
  async send(
    params: { chatId?: string; mode: BuildChatMode; input: ResolveBuildInput },
    token: string | undefined,
    userId?: string,
  ): Promise<{ result: SendBuildChatResult; token: string }> {
    if (!this.enabled) throw matcherNotConfigured();

    const sessionToken = token ?? randomUUID();
    const chat = await this.loadOrCreateChat(
      params.chatId,
      params.mode,
      sessionToken,
      userId,
    );

    // 1. Persist the maker's message.
    const userMsg = await this.prisma.buildChatMessage.create({
      data: {
        chatId: chat.id,
        role: 'USER',
        content: this.describeUserInput(params.input),
      },
      select: { id: true, role: true, content: true, createdAt: true },
    });
    await this.maybeSeedTitle(chat, params.input);

    // 2. Produce the assistant turn.
    let assistantText: string;
    let build: BuildDetail | null = null;

    if (params.input.kind === 'image' || params.input.kind === 'url') {
      // Direct-resolve doors — no conversational call needed.
      build = await this.tryResolve(params.input, sessionToken, userId);
      assistantText = build
        ? this.resolveSummary(build, params.input.kind)
        : params.input.kind === 'image'
          ? "I couldn't read any parts from that photo. Try a clearer shot, or paste the parts as text."
          : "I couldn't find a parts list at that link. Paste the parts here and I'll match them.";
    } else {
      // Conversational turn — the model decides whether to resolve.
      const history = await this.history(chat.id);
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt(params.mode) },
        ...history,
      ];
      const env = this.parseEnvelope(await this.llm.complete(messages));
      assistantText = env.reply;
      if (env.resolve && env.partsList && env.partsList.trim()) {
        build = await this.tryResolve(
          { kind: 'text', text: env.partsList },
          sessionToken,
          userId,
        );
        if (!build) {
          assistantText +=
            "\n\n(I tried to match those parts, but couldn't find them in the catalog yet.)";
        }
      }
    }

    // 3. Persist the assistant message (carrying the build, if any).
    const assistantMsg = await this.prisma.buildChatMessage.create({
      data: {
        chatId: chat.id,
        role: 'ASSISTANT',
        content: assistantText,
        buildId: build?.id ?? null,
      },
      select: { id: true, role: true, content: true, createdAt: true },
    });

    // 4. Persist the (possibly switched) mode + bump updatedAt.
    const updated = await this.prisma.buildChat.update({
      where: { id: chat.id },
      data: { mode: params.mode },
      select: { ...chatSummarySelect, _count: { select: { messages: true } } },
    });

    return {
      token: sessionToken,
      result: {
        chat: this.toSummary(updated),
        userMessage: this.toMessageDto(userMsg, null),
        assistantMessage: this.toMessageDto(assistantMsg, build),
        build,
      },
    };
  }

  /** Delete a chat the caller owns. 404 when missing or not theirs. */
  async deleteChat(
    id: string,
    token: string | undefined,
    userId?: string,
  ): Promise<{ id: string }> {
    const owner = this.ownerWhere(token, userId);
    const chat = owner
      ? await this.prisma.buildChat.findFirst({
          where: { id, ...owner },
          select: { id: true },
        })
      : null;
    if (!chat) throw this.notFound();
    await this.prisma.buildChat.delete({ where: { id: chat.id } });
    return { id: chat.id };
  }

  /* ------------------------------ Helpers ----------------------------- */

  /** Resolve a parts source, degrading an empty match (400) to null, not a throw. */
  private async tryResolve(
    input: ResolveBuildInput,
    token: string,
    userId?: string,
  ): Promise<BuildDetail | null> {
    try {
      const { build } = await this.storefront.resolveBuild(token, input, userId);
      return build;
    } catch (err) {
      if (err instanceof BadRequestException) return null; // nothing matched
      throw err; // a real outage (503) still bubbles up
    }
  }

  /** Load the caller's chat by id, else create a fresh one they own. */
  private async loadOrCreateChat(
    chatId: string | undefined,
    mode: BuildChatMode,
    token: string,
    userId?: string,
  ): Promise<{ id: string; title: string }> {
    if (chatId) {
      const owner = this.ownerWhere(token, userId);
      const existing = owner
        ? await this.prisma.buildChat.findFirst({
            where: { id: chatId, ...owner },
            select: { id: true, title: true },
          })
        : null;
      if (existing) return existing;
      // Unknown / not-owned id → start a new chat instead of leaking another's.
    }
    return this.prisma.buildChat.create({
      data: { mode, sessionToken: token, userId: userId ?? null },
      select: { id: true, title: true },
    });
  }

  /** The recent conversation, mapped to provider-neutral chat turns. */
  private async history(chatId: string): Promise<ChatMessage[]> {
    const rows = await this.prisma.buildChatMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_TURNS * 2,
      select: { role: true, content: true, buildId: true },
    });
    return rows.slice(-HISTORY_TURNS).map((r) => ({
      role: r.role === 'ASSISTANT' ? 'assistant' : 'user',
      content: r.buildId
        ? `${r.content}\n[resolved a parts list into a cart]`
        : r.content,
    }));
  }

  /** Coerce the model's raw output into the resolve envelope; tolerate non-JSON. */
  private parseEnvelope(raw: string): {
    reply: string;
    resolve: boolean;
    partsList: string | null;
  } {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const reply =
        typeof obj.reply === 'string' && obj.reply.trim()
          ? obj.reply.trim()
          : "Sorry, I didn't catch that — could you say it another way?";
      return {
        reply,
        resolve: obj.resolve === true,
        partsList: typeof obj.partsList === 'string' ? obj.partsList : null,
      };
    } catch {
      // Model ignored JSON mode — treat the whole text as the reply.
      return {
        reply: raw.trim() || 'Sorry, something went wrong generating a reply.',
        resolve: false,
        partsList: null,
      };
    }
  }

  /** A short human label stored as the user message for non-text doors. */
  private describeUserInput(input: ResolveBuildInput): string {
    if (input.kind === 'image') return `[photo] ${input.filename}`;
    if (input.kind === 'url') return `[link] ${input.url}`;
    return input.text;
  }

  /** Templated reply for the photo/link doors (no LLM call there). */
  private resolveSummary(build: BuildDetail, kind: 'image' | 'url'): string {
    const src = kind === 'image' ? 'your photo' : 'that link';
    return `I read ${src} and matched ${build.inStockCount} of ${build.partCount} parts. Here's your build — review the matches below and add them to your cart.`;
  }

  /** Seed a readable title from the first maker input while it's still default. */
  private async maybeSeedTitle(
    chat: { id: string; title: string },
    input: ResolveBuildInput,
  ): Promise<void> {
    if (chat.title !== DEFAULT_TITLE) return;
    const seed =
      input.kind === 'text'
        ? input.text
        : input.kind === 'url'
          ? input.url
          : input.filename;
    const title = seed.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (title) {
      await this.prisma.buildChat.update({
        where: { id: chat.id },
        data: { title },
      });
    }
  }

  /** Ownership filter: prefer the signed-in user, else the guest cookie token. */
  private ownerWhere(
    token: string | undefined,
    userId?: string,
  ): { userId: string } | { sessionToken: string } | null {
    if (userId) return { userId };
    if (token) return { sessionToken: token };
    return null;
  }

  private toSummary(row: ChatSummaryRow): BuildChatSummary {
    return {
      id: row.id,
      title: row.title,
      mode: row.mode,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messageCount: row._count?.messages ?? 0,
    };
  }

  private toMessageDto(
    m: MessageRow,
    build: BuildDetail | null,
  ): BuildChatMessageDto {
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      build,
      createdAt: m.createdAt.toISOString(),
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException(
      fieldError('id', 'Chat not found', 404, 'NotFound'),
    );
  }
}
