import { apiClient } from "./apiClient";
import { Department, DepartmentDto } from "../types/TypeDepartment";

const BASE_URL = "/sections";

// เรียกใช้งาน API เพื่อดึงข้อมูลแผนกทั้งหมด
export async function getAllDepartment(): Promise<Department[]> {

  const res = await apiClient.get(BASE_URL);

  return res.data;
}

// เรียกใช้งาน API เพื่อดึงข้อมูลแผนกตาม ID
export async function getDepartmentById(id: string): Promise<Department> {

  const res = await apiClient.get(`${BASE_URL}/${id}`);

  return res.data;
}

// เรียกใช้งาน API เพื่อสร้างแผนกใหม่
export async function createDepartment(
  department: DepartmentDto,
): Promise<Department> {

  const res = await apiClient.post(BASE_URL, department, {
    headers: {
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

  const res = await apiClient.patch(`${BASE_URL}/${id}`, department, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  return res.data;
}

// เรียกใช้งาน API เพื่อลบข้อมูลแผนกตาม ID
export async function deleteDepartmentById(id: string): Promise<Department> {

  const res = await apiClient.delete(`${BASE_URL}/${id}`);

  return res.data;
}
