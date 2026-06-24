// Same Prisma/genai stubbing rationale as storefront.service.spec.ts: the
// generated client + the genai ESM package can't be resolved by Jest's CJS
// resolver, so we replace them. The chat service (and the StorefrontService +
// dto it transitively loads) reference these enum values at import/decoration
// time, so the mock must expose them.
jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {},
  FulfillmentType: { DELIVERY: 'DELIVERY', PICKUP: 'PICKUP' },
  BuildChatMode: {
    BRAINSTORM: 'BRAINSTORM',
    GRILL: 'GRILL',
    IMPECCABLE: 'IMPECCABLE',
  },
}));
jest.mock('@google/genai', () => ({ GoogleGenAI: class {}, Type: {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { BuildChatService } from './build-chat.service';
import { BuildChatLlmService } from './build-chat-llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService, type BuildDetail } from './storefront.service';

const FAKE_BUILD = {
  id: 'build-9',
  slug: 'build-9',
  title: 'ESP32 build',
  sourceType: 'TEXT',
  parts: [],
  unmatched: [],
  partCount: 1,
  inStockCount: 1,
  estimatedTotal: 355,
  createdAt: '2026-06-24T00:00:00.000Z',
} as unknown as BuildDetail;

function makePrismaStub() {
  let chat: Record<string, unknown> | null = null;
  const messages: { role: string; content: string; buildId: string | null }[] =
    [];
  return {
    messages,
    buildChat: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        chat = {
          id: 'chat-1',
          title: 'New build chat',
          mode: data.mode,
          sessionToken: data.sessionToken ?? null,
          userId: data.userId ?? null,
          createdAt: new Date('2026-06-24T00:00:00Z'),
          updatedAt: new Date('2026-06-24T00:00:00Z'),
        };
        return Promise.resolve({ id: chat.id, title: chat.title });
      }),
      findFirst: jest.fn(() =>
        Promise.resolve(chat ? { id: chat.id, title: chat.title } : null),
      ),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        chat = { ...(chat ?? {}), ...data, updatedAt: new Date() };
        return Promise.resolve({ ...chat, _count: { messages: messages.length } });
      }),
      findMany: jest.fn(() => Promise.resolve([])),
      delete: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve({ id: where.id }),
      ),
    },
    buildChatMessage: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        messages.push({
          role: data.role as string,
          content: data.content as string,
          buildId: (data.buildId as string) ?? null,
        });
        return Promise.resolve({
          id: `m${messages.length}`,
          role: data.role,
          content: data.content,
          createdAt: new Date(),
        });
      }),
      findMany: jest.fn(() =>
        Promise.resolve(
          messages.map((m) => ({
            role: m.role,
            content: m.content,
            buildId: m.buildId,
          })),
        ),
      ),
    },
  };
}

describe('BuildChatService', () => {
  let service: BuildChatService;
  let prisma: ReturnType<typeof makePrismaStub>;
  let llm: { enabled: boolean; complete: jest.Mock };
  let storefront: { resolveBuild: jest.Mock; getBuild: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaStub();
    llm = { enabled: true, complete: jest.fn() };
    storefront = { resolveBuild: jest.fn(), getBuild: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BuildChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: BuildChatLlmService, useValue: llm },
        { provide: StorefrontService, useValue: storefront },
      ],
    }).compile();
    service = moduleRef.get(BuildChatService);
  });

  it('persists a user + assistant turn and does not resolve on a plain reply', async () => {
    llm.complete.mockResolvedValue(
      JSON.stringify({ reply: 'What sensors do you have?', resolve: false, partsList: null }),
    );
    const { result, token } = await service.send(
      { mode: 'BRAINSTORM', input: { kind: 'text', text: 'weather station' } },
      undefined,
      undefined,
    );
    expect(typeof token).toBe('string'); // minted for the guest
    expect(prisma.buildChatMessage.create).toHaveBeenCalledTimes(2);
    expect(result.assistantMessage.content).toBe('What sensors do you have?');
    expect(result.assistantMessage.build).toBeNull();
    expect(storefront.resolveBuild).not.toHaveBeenCalled();
  });

  it('resolves a build when the envelope asks for it, attaching it to the turn', async () => {
    llm.complete.mockResolvedValue(
      JSON.stringify({ reply: "Here's your build", resolve: true, partsList: '1x ESP32 dev board' }),
    );
    storefront.resolveBuild.mockResolvedValue({ build: FAKE_BUILD, token: 'tok-1' });

    const { result } = await service.send(
      { mode: 'IMPECCABLE', input: { kind: 'text', text: 'finalize it' } },
      'tok-1',
      undefined,
    );

    expect(storefront.resolveBuild).toHaveBeenCalledWith(
      'tok-1',
      { kind: 'text', text: '1x ESP32 dev board' },
      undefined,
    );
    expect(result.build).toBe(FAKE_BUILD);
    expect(result.assistantMessage.build).toBe(FAKE_BUILD);
  });

  it('degrades gracefully when the resolve finds nothing (no throw)', async () => {
    llm.complete.mockResolvedValue(
      JSON.stringify({ reply: 'ok', resolve: true, partsList: 'gibberish' }),
    );
    storefront.resolveBuild.mockRejectedValue(new BadRequestException('none'));

    const { result } = await service.send(
      { mode: 'GRILL', input: { kind: 'text', text: 'x' } },
      'tok',
      undefined,
    );

    expect(result.build).toBeNull();
    expect(result.assistantMessage.content).toContain("couldn't find them");
  });

  it('routes the photo door straight to the resolver (no LLM call)', async () => {
    storefront.resolveBuild.mockResolvedValue({ build: FAKE_BUILD, token: 't' });

    const { result } = await service.send(
      {
        mode: 'BRAINSTORM',
        input: { kind: 'image', data: 'AAAA', mimeType: 'image/png', filename: 'b.png' },
      },
      't',
      undefined,
    );

    expect(llm.complete).not.toHaveBeenCalled();
    expect(storefront.resolveBuild).toHaveBeenCalledWith(
      't',
      expect.objectContaining({ kind: 'image' }),
      undefined,
    );
    expect(result.build).toBe(FAKE_BUILD);
  });

  it('returns no chats for an owner with neither user nor token', async () => {
    await expect(service.listChats(undefined, undefined)).resolves.toEqual([]);
    expect(prisma.buildChat.findMany).not.toHaveBeenCalled();
  });
});
