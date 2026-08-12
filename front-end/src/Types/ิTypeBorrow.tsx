export interface BorrowDto {
  assetId: string;
  borrowerId: string;
  deliveryMethod: "PICKUP";
}

export interface Borrow {
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
  delivery_method: string;
  createdAt: string;
}
