import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

// Structured validation error body shared by all mutation routes.
export interface StructuredErrorBody {
  statusCode: number;
  error: string;
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
}

// Recursively walk class-validator errors, building dotted paths
// (e.g. `variants.0.sku`) → list of constraint messages.
function collect(
  errors: ValidationError[],
  parentPath: string,
  fieldErrors: Record<string, string[]>,
  formErrors: string[],
): void {
  for (const err of errors) {
    const path = parentPath ? `${parentPath}.${err.property}` : err.property;

    if (err.constraints) {
      const messages = Object.values(err.constraints);
      if (path) {
        const bucket = fieldErrors[path] ?? [];
        bucket.push(...messages);
        fieldErrors[path] = bucket;
      } else {
        formErrors.push(...messages);
      }
    }

    if (err.children && err.children.length > 0) {
      collect(err.children, path, fieldErrors, formErrors);
    }
  }
}

// Reusable, route-scoped pipe. Returns a fresh instance per call so it can be
// applied per-handler via `@Body(structuredValidationPipe()) dto: X`.
// Does NOT touch the global pipe in main.ts (which auth DTOs depend on).
export function structuredValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    stopAtFirstError: false,
    exceptionFactory: (errors: ValidationError[]) => {
      const fieldErrors: Record<string, string[]> = {};
      const formErrors: string[] = [];
      collect(errors, '', fieldErrors, formErrors);
      const body: StructuredErrorBody = {
        statusCode: 400,
        error: 'ValidationError',
        fieldErrors,
        formErrors,
      };
      return new BadRequestException(body);
    },
  });
}
