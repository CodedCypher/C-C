import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';

import { structuredValidationPipe } from '../common/validation';
import { fieldError } from '../common/structured-error';
import { buildImageMulterOptions } from '../common/uploads';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import {
  BuildChatService,
  type BuildChatDetail,
  type BuildChatSummary,
  type SendBuildChatResult,
} from './build-chat.service';
import type { ResolveBuildInput } from './storefront.service';
import { SendBuildChatDto } from './dto/storefront.dto';
import { CART_COOKIE, setCartCookie } from './cart.cookie';

/**
 * PUBLIC build-assistant chat API. Namespaced under `build-chats` (not `builds/*`)
 * so it never shadows the saved-build routes. Like the rest of the storefront it
 * carries NO guards: a guest owns their chats via the opaque `cr_cart` cookie, a
 * signed-in maker via the `cr_at` access cookie — the same ownership chain as
 * SavedBuild and the guest cart.
 */
@Controller('storefront')
export class BuildChatController {
  constructor(
    private readonly chat: BuildChatService,
    private readonly jwt: JwtService,
  ) {}

  private token(req: Request): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[CART_COOKIE];
  }

  /** Best-effort user id from the access cookie (undefined for guests). */
  private userIdFromCookie(req: Request): string | undefined {
    const token = (req.cookies as Record<string, string> | undefined)?.[
      ACCESS_COOKIE
    ];
    if (!token) return undefined;
    try {
      const payload = this.jwt.verify<{ sub: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? '',
      });
      return payload.sub;
    } catch {
      return undefined;
    }
  }

  /**
   * Send one turn (lazy-creates the chat). Multipart-capable: an attached `image`
   * file part is the photo door; otherwise `url` wins over `text`. Mirrors the
   * `checkout` endpoint's multipart + DTO + cookie handling.
   */
  @Post('build-chats')
  @UseInterceptors(FileInterceptor('image', buildImageMulterOptions))
  async send(
    @Body(structuredValidationPipe()) dto: SendBuildChatDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SendBuildChatResult> {
    const input: ResolveBuildInput = file
      ? {
          kind: 'image',
          data: file.buffer.toString('base64'),
          mimeType: file.mimetype,
          filename: file.originalname || 'photo',
        }
      : dto.url
        ? { kind: 'url', url: dto.url }
        : { kind: 'text', text: (dto.text ?? '').trim() };

    if (input.kind === 'text' && !input.text) {
      throw new BadRequestException(
        fieldError(
          'text',
          'Type a message, attach a photo, or paste a link.',
          400,
          'ValidationError',
        ),
      );
    }

    const { result, token } = await this.chat.send(
      { chatId: dto.chatId, mode: dto.mode, input },
      this.token(req),
      this.userIdFromCookie(req),
    );
    setCartCookie(res, token);
    return result;
  }

  /** The caller's chats (newest first). */
  @Get('build-chats')
  list(@Req() req: Request): Promise<BuildChatSummary[]> {
    return this.chat.listChats(this.token(req), this.userIdFromCookie(req));
  }

  /** One chat with its full message log + hydrated inline builds. */
  @Get('build-chats/:id')
  get(@Param('id') id: string, @Req() req: Request): Promise<BuildChatDetail> {
    return this.chat.getChat(id, this.token(req), this.userIdFromCookie(req));
  }

  @Delete('build-chats/:id')
  remove(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ id: string }> {
    return this.chat.deleteChat(id, this.token(req), this.userIdFromCookie(req));
  }
}
