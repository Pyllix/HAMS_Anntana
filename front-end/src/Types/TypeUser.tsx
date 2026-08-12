export type UserRole =
  | "ADMIN"
  | "ASSET_CENTER_STAFF"
  | "user"
  | "technician"
  | "manager"
  | null;

export interface User {
  id: string;
  userName: string;
  firstname: string;
  lastname: string;
  email: string;
  emailVerified: boolean;
  imageUrl: string | null;
  section_id: string;
  role: UserRole
  createdAt: string;
  updatedAt: string;
}
