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
export async function getAllUser(): Promise<User[]> {
  const token = localStorage.getItem("token");

  const res = await axios.get(`https://hams-anntana.onrender.com/users/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data.data;
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
