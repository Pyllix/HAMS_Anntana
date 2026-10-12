export const SPAREPART_TXN_TYPES = [
  'WITHDRAW',
  'RETURN',
  'ADJUST',
  'PENDING_WITHDRAW',
] as const;

export const DEFAULT_SPAREPART_HISTORY_TYPES = ['WITHDRAW', 'RETURN'] as const;

export type SparepartTxnType = (typeof SPAREPART_TXN_TYPES)[number];
