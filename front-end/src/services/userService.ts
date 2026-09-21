import axios from "axios";
import { User } from "../types/TypeUser";

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
