import axios from "axios";
import { User, UserDto } from "../types/TypeUser";

// เรียกใช้งาน API เพื่อดึงข้อมูลผู้ใช้ตาม ID
export async function getUserById(id: string): Promise<User> {
  const token = localStorage.getItem("token");

  const res = await axios.get(`https://hams-anntana.onrender.com/users/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
}

// เรียกใช้งาน API เพื่อดึงข้อมูลผู้ใช้ทั้งหมด
// API แบ่งหน้า (limit สูงสุด 100) จึงต้องวนดึงให้ครบทุกหน้า
export async function getAllUser(): Promise<User[]> {
  const token = localStorage.getItem("token");
  const users: User[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await axios.get(`https://hams-anntana.onrender.com/users/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
  const token = localStorage.getItem("token");

  const res = await axios.post(
    "https://hams-anntana.onrender.com/users",
    user,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  return res.data;
}

// เรียกใช้งาน API เพื่อลบข้อมูลผู้ใช้ตาม ID
export async function deleteUserById(id: string): Promise<{ message: string }> {
  const token = localStorage.getItem("token");

  const res = await axios.delete(
    `https://hams-anntana.onrender.com/users/${id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return res.data;
}

// เรียกใช้งาน API เพื่อแก้ไขข้อมูลผู้ใช้ตาม ID (ไม่รวมรหัสผ่าน)
export async function updateUserById(
  id: string,
  user: Partial<Omit<UserDto, "password">>,
): Promise<User> {
  const token = localStorage.getItem("token");

  const res = await axios.patch(
    `https://hams-anntana.onrender.com/users/${id}`,
    user,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  return res.data;
}
