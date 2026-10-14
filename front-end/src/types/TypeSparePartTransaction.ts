// ชนิดข้อมูลสำหรับรายงานการเบิกอะไหล่ (GET /spare-parts/transactions)
// หนึ่งแถว = หนึ่งรายการ transaction (ไม่จัดกลุ่มตามงานซ่อมหรืออะไหล่)

export type SparePartTxnType = "WITHDRAW" | "RETURN" | "PENDING_WITHDRAW";

export type SparePartStockType = "INTERNAL" | "EXTERNAL" | null;

export interface SparePartTxnSparepart {
  id: number;
  code: string;
  name: string;
  unit: string;
}

export interface SparePartTxnRepairJob {
  id: string;
  jobNo: string;
}

export interface SparePartTxnRecordedBy {
  id: string;
  name: string;
}

export interface SparePartTransaction {
  id: number;
  txnType: SparePartTxnType;
  stockType: SparePartStockType;
  txnDate: string;
  qty: number;
  sparepart: SparePartTxnSparepart;
  // null เมื่อ transaction ไม่มีงานซ่อมอ้างอิง
  repairJob: SparePartTxnRepairJob | null;
  // บัญชีที่บันทึก/ยืนยัน transaction (ไม่ใช่ผู้ขอเบิกหรือผู้คืนของจริง)
  recordedBy: SparePartTxnRecordedBy;
}
