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
