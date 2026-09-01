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
  returnCondition: string;
  returnMethod: string;
  returnRemark: string;
  returnedByUserId: string;
}

export interface ReturnRes {
  id: string;
  asset_id: string;
  borrower_id: string;
  returned_by_user_id: string;
  received_by_user_id: string;
  borrow_status_id: number;
  return_date: string;
  return_condition: string;
  return_method: string;
  return_remark: string;
  request_source: string;
  delivery_method: string;
  createdAt: string;
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
