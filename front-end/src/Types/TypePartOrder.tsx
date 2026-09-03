// ─── Types for Part Order Management (ระบบสั่งซื้ออะไหล่) ──────────────────────

export type PartOrderStatus =
  | "PENDING_PURCHASE_INFO" // รอระบุข้อมูลจัดซื้อ (แดง)
  | "PENDING_APPROVAL"      // รออนุมัติ (ส้ม)
  | "APPROVED"              // ผู้บริหารอนุมัติแล้ว (น้ำเงิน)
  | "ORDERING"              // กำลังสั่งซื้อ (เขียว)
  | "RECEIVED";             // ตรวจรับแล้ว (เขียวเข้ม)

export type PartOrderUrgency = "NORMAL" | "URGENT" | "EMERGENCY";

export interface PartOrder {
  id: number;
  orderNo: string;               // e.g. "PO-499"
  partName: string;              // e.g. "หลอดนีออน 20 W PH"
  quantity: number;              // e.g. 10
  unit: string;                  // e.g. "หลอด", "ก้อน", "ชุด"
  category: string;              // e.g. "วัสดุไฟฟ้า", "อะไหล่เครื่องมือแพทย์"
  urgency: PartOrderUrgency;     // "NORMAL" | "URGENT" | "EMERGENCY"
  requesterName: string;         // e.g. "นายมานะ อดทน"
  department: string;            // e.g. "ช่าง", "ศูนย์ครุภัณฑ์"
  
  // ข้อมูลการจัดซื้อ (Purchasing Info / SPAREPART_ADD table)
  sparepart_add_id?: number;
  sparepart_id?: number;
  brandModel?: string;           // e.g. "Philips Super 80 T8 20W"
  supplier?: string;             // e.g. "ร้านไฟฟ้าแสงทอง พลาซ่า"
  unitPrice?: number;            // e.g. 65.00
  totalPrice?: number;           // e.g. 650.00
  sparepart_add_doc?: string;    // แนบไฟล์เอกสารจัดซื้อ / ใบเสนอราคา (PDF/Image)
  orderDate?: string;            // e.g. "2026-03-21" or "21/03/2569"
  
  status: PartOrderStatus;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface UpdatePurchasingInfoDto {
  brandModel: string;
  supplier: string;
  unitPrice: number;
  totalPrice: number;
  sparepart_add_doc?: string;
  orderDate?: string;
  note?: string;
}
