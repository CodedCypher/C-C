// Shared page/take clamp logic used across all list endpoints.
// Mirrors the original admin.service behavior exactly:
//   page = Math.max(1, Number(page) || 1)
//   take = Math.min(200, Math.max(1, Number(take) || 20))

export function clampPage(page?: number): number {
  return Math.max(1, Number(page) || 1);
}

export function clampTake(take?: number): number {
  return Math.min(200, Math.max(1, Number(take) || 20));
}

export interface Paging {
  page: number;
  take: number;
  skip: number;
}

export function normalizePaging(params: {
  page?: number;
  take?: number;
}): Paging {
  const page = clampPage(params.page);
  const take = clampTake(params.take);
  const skip = (page - 1) * take;
  return { page, take, skip };
}
