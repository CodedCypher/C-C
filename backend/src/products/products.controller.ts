import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ProductsService,
  ProductsResult,
  CreateProductResult,
  BrandOption,
  CategoryOption,
  FormOptions,
} from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/client';
import {
  CreateBrandDto,
  CreateCategoryDto,
  CreateProductDto,
} from './dto/create-product.dto';
import { structuredValidationPipe } from '../common/validation';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  products(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ): Promise<ProductsResult> {
    return this.productsService.products({
      status,
      q,
      page: page ? Number(page) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('form-options')
  formOptions(): Promise<FormOptions> {
    return this.productsService.productFormOptions();
  }

  @Post()
  createProduct(
    @Body(structuredValidationPipe()) dto: CreateProductDto,
  ): Promise<CreateProductResult> {
    return this.productsService.createProduct(dto);
  }

  @Post('brands')
  createBrand(
    @Body(structuredValidationPipe()) dto: CreateBrandDto,
  ): Promise<BrandOption> {
    return this.productsService.createBrand(dto);
  }

  @Post('categories')
  createCategory(
    @Body(structuredValidationPipe()) dto: CreateCategoryDto,
  ): Promise<CategoryOption> {
    return this.productsService.createCategory(dto);
  }
}
