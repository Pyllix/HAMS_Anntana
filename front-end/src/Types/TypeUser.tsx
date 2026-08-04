export type UserRole =
  | "admin"
  | "inventory_officer"
  | "user"
  | "technician"
  | "manager"
  | null;

export interface User {
  user_id: string;

  user_name: string;

  first_name: string;

  last_name: string;

  email: string;

  password_hash: string;

  section_id: string;

  role: UserRole;

  image_url: string | null;

  createdAt: Date | string;

  updatedAt: Date | string;

  deleteAt: Date | string | null;
}
