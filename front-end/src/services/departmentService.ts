import axios from "axios";
import { Department, DepartmentDto } from "../types/TypeDepartment";

const BASE_URL = "https://hams-anntana.onrender.com/sections";

// เรียกใช้งาน API เพื่อดึงข้อมูลแผนกทั้งหมด
export async function getAllDepartment(): Promise<Department[]> {
  const token = localStorage.getItem("token");

  const res = await axios.get(BASE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
}

// เรียกใช้งาน API เพื่อดึงข้อมูลแผนกตาม ID
export async function getDepartmentById(id: string): Promise<Department> {
  const token = localStorage.getItem("token");

  const res = await axios.get(`${BASE_URL}/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
}

// เรียกใช้งาน API เพื่อสร้างแผนกใหม่
export async function createDepartment(
  department: DepartmentDto,
): Promise<Department> {
  const token = localStorage.getItem("token");

  const res = await axios.post(BASE_URL, department, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return res.data;
}

// เรียกใช้งาน API เพื่อแก้ไขข้อมูลแผนก
export async function updateDepartment(
  id: string,
  department: Partial<DepartmentDto>,
): Promise<Department> {
  const token = localStorage.getItem("token");

  const res = await axios.patch(`${BASE_URL}/${id}`, department, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return res.data;
}

// เรียกใช้งาน API เพื่อลบข้อมูลแผนกตาม ID
export async function deleteDepartmentById(id: string): Promise<Department> {
  const token = localStorage.getItem("token");

  const res = await axios.delete(`${BASE_URL}/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
}
