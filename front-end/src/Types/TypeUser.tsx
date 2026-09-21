import { RoleType } from "../router/roles";

export interface User {
  id: string;
  employeeId: string;
  userName: string;
  firstname: string;
  lastname: string;
  email: string;
  emailVerified: boolean;
  imageUrl: string | null;
  section_id: string;
  role: RoleType;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserDto {
  userName: string | "";
  firstname: string;
  lastname: string;
  email: string;
  password?: string;
  role: RoleType;
  sectionId: string;
}
