import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StorefrontController } from './storefront.controller';
import { StorefrontService } from './storefront.service';
import { BuildMatcherService } from './build-matcher.service';
import { GroqMatcherService } from './groq-matcher.service';
import { GeminiMatcherService } from './gemini-matcher.service';
import { UrlFetcherService } from './url-fetcher.service';
import { BuildChatController } from './build-chat.controller';
import { BuildChatService } from './build-chat.service';
import { BuildChatLlmService } from './build-chat-llm.service';
import { GroqChatService } from './groq-chat.service';
import { GeminiChatService } from './gemini-chat.service';

/**
 * Public, unguarded storefront surface (PDP + guest cart + 3-step checkout +
 * build assistant). JwtModule lets checkout/chat best-effort decode the `cr_at`
 * cookie to attach a signed-in user (guests still allowed).
 *
 * Both AI surfaces are provider-pluggable, Groq-primary / Gemini-fallback:
 * BuildMatcherService fans over the matcher providers, BuildChatLlmService over
 * the chat providers — so every provider must be registered here.
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [StorefrontController, BuildChatController],
  providers: [
    StorefrontService,
    BuildMatcherService,
    GroqMatcherService,
    GeminiMatcherService,
    UrlFetcherService,
    BuildChatService,
    BuildChatLlmService,
    GroqChatService,
    GeminiChatService,
  ],
})
export class StorefrontModule {}
