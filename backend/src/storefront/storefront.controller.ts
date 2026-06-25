import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import {
  buildImageMulterOptions,
  paymentProofMulterOptions,
  PROOF_DIR,
  uploadUrl,
} from '../common/uploads';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import {
  StorefrontService,
  type BranchSummary,
  type BuildDetail,
  type BuildSummary,
  type CartDto,
  type CheckoutResult,
  type PaymentMethodSummary,
  type ProductDetail,
  type ProductSummary,
  type ProjectDetail,
  type ProjectSummary,
  type RefOption,
  type ResolveBuildInput,
} from './storefront.service';
import {
  AddLineDto,
  CheckoutDto,
  ResolveBuildDto,
  UpdateLineDto,
} from './dto/storefront.dto';
import { CART_COOKIE, clearCartCookie, setCartCookie } from './cart.cookie';

/**
 * PUBLIC storefront API. Unlike the admin domain controllers, this carries NO
 * guards — it's the shopper-facing surface. It lives under the `/storefront`
 * prefix so it never collides with the guarded admin product routes at root.
 * The guest cart is keyed by the opaque `cr_cart` httpOnly cookie. Checkout
 * optionally reads the `cr_at` access cookie to attach a signed-in user.
 */
@Controller('storefront')
export class StorefrontController {
  constructor(
    private readonly storefront: StorefrontService,
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

  @Get('products')
  featured(@Query('limit') limit?: string): Promise<ProductSummary[]> {
    return this.storefront.featured(limit ? Number(limit) : undefined);
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string): Promise<ProductDetail> {
    return this.storefront.productDetail(slug);
  }

  @Get('projects')
  projects(): Promise<ProjectSummary[]> {
    return this.storefront.listProjects();
  }

  @Get('projects/:slug')
  project(@Param('slug') slug: string): Promise<ProjectDetail> {
    return this.storefront.projectDetail(slug);
  }

  /* ----- Builds — resolve maker inspiration into a saved, shareable cart ----- */

  /**
   * Resolve a pasted parts list (`text`) into a persisted build. Mirrors
   * `addLine`'s cookie handling so the build and the guest cart share a
   * `cr_cart` owner.
   */
  @Post('builds/resolve')
  async resolveBuild(
    @Body(structuredValidationPipe()) dto: ResolveBuildDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BuildDetail> {
    const input: ResolveBuildInput = { kind: 'text', text: dto.text ?? '' };
    const { build, token } = await this.storefront.resolveBuild(
      this.token(req),
      input,
      this.userIdFromCookie(req),
    );
    setCartCookie(res, token);
    return build;
  }

  /**
   * Photo door — resolve a schematic / breadboard / printed-BOM photo into a
   * build. Multipart (`image`); the upload is held in memory and handed to the
   * vision model, never written to disk.
   */
  @Post('builds/resolve-image')
  @UseInterceptors(FileInterceptor('image', buildImageMulterOptions))
  async resolveBuildImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BuildDetail> {
    if (!file) {
      throw new BadRequestException(
        fieldError(
          'image',
          'Attach a photo of your parts.',
          400,
          'ValidationError',
        ),
      );
    }
    const input: ResolveBuildInput = {
      kind: 'image',
      data: file.buffer.toString('base64'),
      mimeType: file.mimetype,
      filename: file.originalname || 'photo',
    };
    const { build, token } = await this.storefront.resolveBuild(
      this.token(req),
      input,
      this.userIdFromCookie(req),
    );
    setCartCookie(res, token);
    return build;
  }

  /** "My builds" — the caller's saved builds (by user when signed in, else cookie). */
  @Get('builds')
  myBuilds(@Req() req: Request): Promise<BuildSummary[]> {
    return this.storefront.listBuilds(
      this.token(req),
      this.userIdFromCookie(req),
    );
  }

  @Get('builds/:id')
  build(@Param('id') id: string): Promise<BuildDetail> {
    return this.storefront.getBuild(id);
  }

  @Delete('builds/:id')
  deleteBuild(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ id: string }> {
    return this.storefront.deleteBuild(
      id,
      this.token(req),
      this.userIdFromCookie(req),
    );
  }

  /* ----- Cascading PH address dropdowns ----- */

  @Get('address/regions')
  regions(): Promise<RefOption[]> {
    return this.storefront.regions();
  }

  @Get('address/provinces')
  provinces(@Query('regCode') regCode?: string): Promise<RefOption[]> {
    return this.storefront.provinces(regCode ?? '');
  }

  @Get('address/citymun')
  cityMun(@Query('provCode') provCode?: string): Promise<RefOption[]> {
    return this.storefront.cityMunicipalities(provCode ?? '');
  }

  @Get('address/barangays')
  barangays(@Query('citymunCode') citymunCode?: string): Promise<RefOption[]> {
    return this.storefront.barangays(citymunCode ?? '');
  }

  /* ----- Pickup branches + payment methods ----- */

  @Get('branches')
  branches(): Promise<BranchSummary[]> {
    return this.storefront.branches();
  }

  @Get('payment-methods')
  paymentMethods(): Promise<PaymentMethodSummary[]> {
    return this.storefront.paymentMethods();
  }

  @Get('cart')
  cart(@Req() req: Request): Promise<CartDto> {
    return this.storefront.getCart(this.token(req));
  }

  @Post('cart/lines')
  async addLine(
    @Body(structuredValidationPipe()) dto: AddLineDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartDto> {
    const { cart, token } = await this.storefront.addLine(this.token(req), dto);
    setCartCookie(res, token);
    return cart;
  }

  @Patch('cart/lines/:variantId')
  updateLine(
    @Param('variantId') variantId: string,
    @Body(structuredValidationPipe()) dto: UpdateLineDto,
    @Req() req: Request,
  ): Promise<CartDto> {
    return this.storefront.updateLine(this.token(req), variantId, dto);
  }

  @Delete('cart/lines/:variantId')
  removeLine(
    @Param('variantId') variantId: string,
    @Req() req: Request,
  ): Promise<CartDto> {
    return this.storefront.removeLine(this.token(req), variantId);
  }

  /**
   * Atomic multipart checkout: the proof image rides as the `proof` file part,
   * the rest of the order as form fields. Creates Order + Payment together.
   */
  @Post('checkout')
  @UseInterceptors(FileInterceptor('proof', paymentProofMulterOptions))
  async checkout(
    @Body(structuredValidationPipe()) dto: CheckoutDto,
    @UploadedFile() proof: Express.Multer.File | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CheckoutResult> {
    if (!proof) {
      throw new BadRequestException(
        fieldError(
          'proof',
          'Upload your proof of payment',
          400,
          'ValidationError',
        ),
      );
    }
    const result = await this.storefront.checkout(
      this.token(req),
      dto,
      uploadUrl(PROOF_DIR, proof.filename),
      this.userIdFromCookie(req),
    );
    clearCartCookie(res);
    return result;
  }
}
