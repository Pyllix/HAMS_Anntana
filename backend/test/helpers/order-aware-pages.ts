type OrderBy = Record<string, 'asc' | 'desc'>;

/** A database may return tied rows in a different order for separate page queries. */
export function orderAwarePages<T extends Record<string, unknown>>(rows: T[]) {
  let queries = 0;
  return ({
    skip = 0,
    take = rows.length,
    orderBy,
  }: {
    skip?: number;
    take?: number;
    orderBy: OrderBy | OrderBy[];
  }): T[] => {
    const candidates = [...rows];
    if (queries++ % 2) candidates.reverse();
    const ordering = Array.isArray(orderBy) ? orderBy : [orderBy];
    candidates.sort((left, right) => {
      for (const field of ordering) {
        for (const [key, direction] of Object.entries(field)) {
          const a = String(left[key]);
          const b = String(right[key]);
          if (a !== b)
            return (a < b ? -1 : 1) * (direction === 'desc' ? -1 : 1);
        }
      }
      return 0;
    });
    return candidates.slice(skip, skip + take);
  };
}
