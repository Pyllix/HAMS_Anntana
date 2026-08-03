import type {
  Asset,
  BorrowTransactionInput,
  ReturnTransactionInput,
} from "../types/manageBorrowTypes"

export const manageBorrowService = {
  processBorrow: (
    assets: Asset[],
    id: string,
    input: BorrowTransactionInput
  ): Asset[] => {
    return assets.map((asset) =>
      asset.id === id
        ? {
            ...asset,
            status: "กำลังยืม",
            borrower: `${input.borrowerName}\n${input.department}`,
            borrowDate: input.borrowDate,
          }
        : asset
    )
  },

  processReturn: (
    assets: Asset[],
    id: string,
    input: ReturnTransactionInput
  ): Asset[] => {
    return assets.map((asset) =>
      asset.id === id
        ? {
            ...asset,
            status: input.condition === "ชำรุด / ส่งซ่อม" ? "ส่งซ่อม" : "ว่าง",
            borrower:
              input.condition === "ชำรุด / ส่งซ่อม"
                ? "ช่างเทคนิค\nฝ่ายซ่อมบำรุง"
                : "-\nCentral Supply",
            borrowDate:
              input.condition === "ชำรุด / ส่งซ่อม" ? input.returnDate : "-",
          }
        : asset
    )
  },
}
