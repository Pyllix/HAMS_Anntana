import { RoleType } from "../router/roles";

export type UserRole = RoleType | null;

export interface User {
  id: string;
  userName: string;
  firstname: string;
  lastname: string;
  email: string;
  emailVerified: boolean;
  imageUrl: string | null;
  section_id: string;
  role: RoleType;
  createdAt: string;
  updatedAt: string;
}
