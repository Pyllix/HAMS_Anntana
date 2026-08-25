import { RoleType } from "../Router/roles";

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
  role: RoleType
  createdAt: string;
  updatedAt: string;
}
