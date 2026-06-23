// Structured-error body matching the route-scoped ValidationPipe shape so the
// frontend gets one consistent contract for both validation + business errors.
export interface StructuredBody {
  statusCode: number;
  error: string;
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
}

export function fieldError(
  field: string,
  message: string,
  statusCode: number,
  error: string,
): StructuredBody {
  return {
    statusCode,
    error,
    fieldErrors: { [field]: [message] },
    formErrors: [],
  };
}

export function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
