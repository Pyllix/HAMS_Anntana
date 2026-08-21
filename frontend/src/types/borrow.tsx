export type BorrowStatus = "all" | "available" | "borrowed" | "repairing"

export interface OptionBorrowStatus {
  value: BorrowStatus
  label: string
}
