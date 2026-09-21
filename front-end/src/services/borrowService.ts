import axios from "axios";

// แปล error message ดิบจาก API ของ borrow ให้เป็นข้อความที่อ่านเข้าใจง่ายขึ้น
// (ครอบคลุมเคสที่พบได้บ่อย เช่น สถานะเปลี่ยนไปแล้ว/ถูกดำเนินการไปก่อนหน้า)
export function getBorrowErrorMessage(err: any): string {
  const rawMessage = err?.response?.data?.message;
  const raw: string = Array.isArray(rawMessage)
    ? rawMessage.join(", ")
    : rawMessage || err?.message || "";

  if (!err?.response) {
    return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง";
  }

  if (/asset availability for id .* has already changed/i.test(raw)) {
    return "ไม่สามารถทำรายการได้ เนื่องจากสถานะครุภัณฑ์ชิ้นนี้ถูกเปลี่ยนแปลงจากที่อื่น (เช่น ถูกแจ้งซ่อม หรือมีการแก้ไขสถานะครุภัณฑ์) กรุณาตรวจสอบสถานะครุภัณฑ์อีกครั้งก่อนดำเนินการต่อ";
  }

  if (/has already been processed or status changed/i.test(raw)) {
    return "รายการนี้ถูกดำเนินการไปแล้ว หรือสถานะมีการเปลี่ยนแปลงโดยผู้อื่น กรุณารีเฟรชหน้าจอแล้วลองใหม่อีกครั้ง";
  }

  if (/only transactions in pending_approve status can be approved/i.test(raw)) {
    return "ไม่สามารถอนุมัติได้ เนื่องจากคำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติแล้ว (อาจถูกอนุมัติ/ปฏิเสธ/ยกเลิกไปก่อนหน้านี้)";
  }

  if (/only transactions in pending_approve status can be rejected/i.test(raw)) {
    return "ไม่สามารถปฏิเสธได้ เนื่องจากคำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติแล้ว (อาจถูกอนุมัติ/ปฏิเสธ/ยกเลิกไปก่อนหน้านี้)";
  }

  if (/only transactions in approved status can be handed over/i.test(raw)) {
    return "ไม่สามารถส่งมอบครุภัณฑ์ได้ เนื่องจากคำขอนี้ไม่ได้อยู่ในสถานะอนุมัติแล้วรอส่งมอบ (อาจถูกส่งมอบ/ยกเลิกไปก่อนหน้านี้)";
  }

  if (/is not available for borrowing/i.test(raw) || /has just been borrowed or reserved/i.test(raw)) {
    return "ไม่สามารถทำรายการยืมได้ เนื่องจากครุภัณฑ์ชิ้นนี้ไม่พร้อมให้ยืมในขณะนี้ กรุณาตรวจสอบสถานะอีกครั้ง";
  }

  if (/transaction is currently in/i.test(raw)) {
    return "ไม่สามารถทำรายการได้ เนื่องจากสถานะของรายการยืมมีการเปลี่ยนแปลงไปแล้ว กรุณารีเฟรชหน้าจอแล้วลองใหม่อีกครั้ง";
  }

  return raw || "เกิดข้อผิดพลาดในการทำรายการ กรุณาลองใหม่อีกครั้ง";
}

export interface BorrowReq {
  assetId: string;
  borrowerId?: string;
  deliveryMethod: string;
  expectedReturnDate?: string;
}

interface BorrowRes {
  id: string;
  asset_id: string;
  borrower_id: string;
  returned_by_user_id: string | null;
  received_by_user_id: string | null;
  borrow_status_id: number;
  return_date: string | null;
  return_condition: string | null;
  return_method: string | null;
  return_remark: string | null;
  request_source: string;
  delivery_method: "PICKUP" | string;
  createdAt: string;
}

export interface ReturnReq {
  returnedByUserId: string;
  returnCondition: string;
  returnRemark: string;
}

export interface ReturnRes {
  id: string;
  asset_id: string;
  borrower_id: string;
  created_by_user_id: string;
  approved_by_user_id: string;
  handover_by_user_id: string;
  returned_by_user_id: string;
  received_by_user_id: string;
  rejected_by_user_id: string | null;
  cancelled_by_user_id: string | null;
  borrow_status_id: number;
  approved_at: string;
  handover_date: string;
  return_date: string;
  cancelled_at: string | null;
  rejected_at: string | null;
  cancel_reason: string | null;
  return_condition: string;
  return_method: string;
  return_remark: string;
  reject_remark: string | null;
  request_source: string;
  delivery_method: string;
  createdAt: string;
}

export interface BorrowHistory {
  id: string;
  borrowNo: string;
  asset_id: string;
  borrower_id: string;
  created_by_user_id: string;
  approved_by_user_id: string;
  handover_by_user_id: string;
  returned_by_user_id: string | null;
  received_by_user_id: string | null;
  rejected_by_user_id: string | null;
  cancelled_by_user_id: string | null;
  borrow_status_id: number;
  expectedReturnDate: string | null;
  approved_at: string | null;
  handover_date: string | null;
  return_date: string | null;
  cancelled_at: string | null;
  rejected_at: string | null;
  cancel_reason: string | null;
  return_condition: string | null;
  return_method: string | null;
  return_remark: string | null;
  reject_remark: string | null;
  request_source: string;
  delivery_method: string;
  createdAt: string;
  asset: {
    id: string;
    name: string;
    model: string;
  };
  borrower: {
    id: string;
    employeeId: string;
    firstname: string;
    lastname: string;
    section_id: string;
  };
  borrowStatus: {
    id: number;
    code: string;
    name: string;
  };
}

export interface ApproveBorrow {
  id: string;
  borrowNo: string;
  asset_id: string;
  borrower_id: string;
  created_by_user_id: string;
  approved_by_user_id: string | null;
  handover_by_user_id: string | null;
  returned_by_user_id: string | null;
  received_by_user_id: string | null;
  rejected_by_user_id: string | null;
  cancelled_by_user_id: string | null;
  borrow_status_id: number;
  expectedReturnDate: string; // ISO 8601 Date String
  extensionCount: number;
  approved_at: string | null; // ISO 8601 Date String
  handover_date: string | null; // ISO 8601 Date String
  return_date: string | null; // ISO 8601 Date String
  cancelled_at: string | null; // ISO 8601 Date String
  rejected_at: string | null; // ISO 8601 Date String
  cancel_reason: string | null;
  return_condition: string | null;
  return_method: string | null;
  return_remark: string | null;
  reject_remark: string | null;
  request_source: "SELF_SERVICE" | string;
  delivery_method: "PICKUP" | string;
  createdAt: string;
}

// ใข้ในการอนุมัติการยืม
export async function approveBorrow(id: string): Promise<ApproveBorrow> {
  const token = localStorage.getItem("token");
  const res = await axios.patch(
    `https://hams-anntana.onrender.com/borrowings/${id}/approve`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

// ใช้ในการปฏิเสธคำขอยืม
export async function rejectBorrow(
  id: string,
  reason?: string,
): Promise<ApproveBorrow> {
  const token = localStorage.getItem("token");
  const res = await axios.patch(
    `https://hams-anntana.onrender.com/borrowings/${id}/reject`,
    { reason },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

// ใช้ในการยืนยันส่งมอบครุภัณฑ์ให้ผู้ยืม (APPROVED -> BORROWED)
export async function handoverAsset(id: string): Promise<ApproveBorrow> {
  const token = localStorage.getItem("token");
  const res = await axios.patch(
    `https://hams-anntana.onrender.com/borrowings/${id}/handover`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

// ใช้ในการรับงานไปเก็บครุภัณฑ์ที่แจ้งคืนแบบ online (PENDING_RETURN -> IN_PICKUP)
export async function claimPickup(id: string): Promise<ApproveBorrow> {
  const token = localStorage.getItem("token");
  const res = await axios.patch(
    `https://hams-anntana.onrender.com/borrowings/${id}/claim-pickup`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export interface CompleteReturnReq {
  returnCondition: "Normal" | "Damage";
  returnRemark?: string;
}

// ใช้ในการตรวจรับสภาพและบันทึกคืนครุภัณฑ์เข้าคลัง (IN_PICKUP / PENDING_RETURN -> RETURNED)
export async function completeReturn(
  id: string,
  data: CompleteReturnReq,
): Promise<ApproveBorrow> {
  const token = localStorage.getItem("token");
  const res = await axios.patch(
    `https://hams-anntana.onrender.com/borrowings/${id}/complete-return`,
    data,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export async function postBorrow(borrow: BorrowReq): Promise<BorrowRes> {
  const token = localStorage.getItem("token");

  const res = await axios.post(
    `https://hams-anntana.onrender.com/borrowings`,
    borrow,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return res.data;
}

export async function returnAsset(
  id: string,
  data: ReturnReq,
): Promise<ReturnRes> {
  const token = localStorage.getItem("token");

  const res = await axios.patch(
    `https://hams-anntana.onrender.com/borrowings/${id}/return`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return res.data;
}

export async function getAllBorrowHistory(params?: {
  limit?: number;
  page?: number;
}): Promise<BorrowHistory[]> {
  const token = localStorage.getItem("token");

  const res = await axios.get(`https://hams-anntana.onrender.com/borrowings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params,
  });

  return res.data.data;
}
