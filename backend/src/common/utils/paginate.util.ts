export interface PaginationMeta {
  /** Current page (1-based) */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of matching records */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether a next page exists */
  hasNextPage: boolean;
  /** Whether a previous page exists */
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Build a PaginatedResult from Prisma findMany results.
 *
 * @param data    - Array of records from Prisma
 * @param total   - Total count from Prisma count()
 * @param page    - Current page (1-based)
 * @param limit   - Items per page
 */
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
