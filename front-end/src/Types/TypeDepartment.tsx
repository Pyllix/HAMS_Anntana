export interface Department {
  id: string;
  code: string;
  name: string;
  tel: string;
  building: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentDto {
  code: string;
  name: string;
  tel?: string;
  building?: string;
}
