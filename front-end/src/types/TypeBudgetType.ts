export interface BudgetType {
  id: number;
  name: string;
  fiscalYear?: number | null;
  description?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CreateBudgetTypeDto {
  name: string;
  fiscalYear?: number;
  description?: string;
  isActive?: boolean;
}

export interface UpdateBudgetTypeDto {
  name?: string;
  fiscalYear?: number;
  description?: string;
  isActive?: boolean;
}
