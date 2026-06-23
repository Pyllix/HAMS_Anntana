import type {
  Asset,
  BorrowTransactionInput,
  ReturnTransactionInput,
} from "@/types/equipmentBorrowTypes"

export const equipmentBorrowService = {
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
            borrowerName: input.borrowerName,
            ward: input.ward,
            borrowDate: `${input.borrowDate} ${input.borrowTime}`,
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
            borrowerName:
              input.condition === "ชำรุด / ส่งซ่อม" ? "ช่างเทคนิค" : undefined,
            ward:
              input.condition === "ชำรุด / ส่งซ่อม"
                ? "ฝ่ายซ่อมบำรุง"
                : undefined,
            borrowDate:
              input.condition === "ชำรุด / ส่งซ่อม"
                ? input.returnDate
                : undefined,
          }
        : asset
    )
  },
}
