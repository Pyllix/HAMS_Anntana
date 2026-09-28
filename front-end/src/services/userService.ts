import { apiClient } from "./apiClient";
import type { User, UserDto } from "../types/TypeUser";

export type UserUpdateDto = Partial<Omit<UserDto, "password">> & {
  banned?: boolean;
};

// เรียกใช้งาน API เพื่อดึงข้อมูลผู้ใช้ตาม ID
export async function getUserById(id: string): Promise<User> {
  const res = await apiClient.get(`/users/${id}`);
  return res.data;
}

// เรียกใช้งาน API เพื่อดึงข้อมูลผู้ใช้ทั้งหมด
// API แบ่งหน้า (limit สูงสุด 100) จึงต้องวนดึงให้ครบทุกหน้า
export async function getAllUser(): Promise<User[]> {
  const users: User[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await apiClient.get<{ data: User[]; meta?: { hasNextPage?: boolean } }>("/users/", {
      params: { page, limit: 100 },
    });

    users.push(...res.data.data);
    hasNextPage = res.data.meta?.hasNextPage ?? false;
    page++;
  }

  return users;
}

// เรียกใช้งาน API เพื่อสร้างผู้ใช้ใหม่
export async function createUser(user: UserDto): Promise<User> {
  const res = await apiClient.post("/users", user, {
    headers: {
      "Content-Type": "application/json",
    },
  });
  return res.data;
}

// เรียกใช้งาน API เพื่อแก้ไขผู้ใช้
export async function updateUserById(
  id: string,
  user: UserUpdateDto,
): Promise<User> {
  const res = await apiClient.patch(`/users/${id}`, user);
  return res.data;
}

// เรียกใช้งาน API เพื่อลบข้อมูลผู้ใช้ตาม ID
export async function deleteUserById(id: string): Promise<{ message: string }> {
  const res = await apiClient.delete(`/users/${id}`);
  return res.data;
}
