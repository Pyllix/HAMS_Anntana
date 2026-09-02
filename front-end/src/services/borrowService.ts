import axios from "axios";

interface BorrowReq {
  assetId: string;
  borrowerId: string;
  deliveryMethod: string;
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

export async function getAllBorrowHistory(): Promise<BorrowHistory[]> {
  const token = localStorage.getItem("token");

  const res = await axios.get(`https://hams-anntana.onrender.com/borrowings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data.data;
}
