export interface AcqType {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CreateAcqTypeDto {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateAcqTypeDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}
