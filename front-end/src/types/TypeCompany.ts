export interface Company {
  id: string | number;
  code: string;
  name: string;
  tel?: string | null;
  address?: string | null;
  fax?: string | null;
  group?: string | null;
  remark?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CreateCompanyDto {
  code: string;
  name: string;
  tel?: string;
  address?: string;
  fax?: string;
  group?: string;
  remark?: string;
  isActive?: boolean;
}

export interface UpdateCompanyDto {
  code?: string;
  name?: string;
  tel?: string;
  address?: string;
  fax?: string;
  group?: string;
  remark?: string;
  isActive?: boolean;
}
