export interface SectionDto {
  code: string;
  name: string;
  tel: string;
  building: string;
}

export interface Section {
  id: string;
  code: string;
  name: string;
  tel: string;
  building: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDto {
  code: string;
  name: string;
  tel: string;
  address: string;
  fax: string;
  group: string;
  remark: string;
}

export interface Company {
  id: string;
  code: string;
  name: string;
  tel: string;
  email: string;
  address: string;
  fax: string;
  group: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetTypeDto {
  name: string;
  useful_life: number;
}

export interface AssetType {
  id: number;
  name: string;
  useful_life: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetStatusDto {
  code: string;
  name: string;
}

export interface AssetStatus {
  id: number;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilitiesDto {
  code: string;
  name: string;
}

export interface Availabilities {
  id: number;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDto {
  name: string;
  model: string;
  serialNo: string;
  gmdn: string;
  price: string;
  warrantyDate: string;
  riskLevel: number;
  isMedicalDevice: boolean;
  remark: string | null;
  imageUrl: string | null;
  receivedDate: string;
  section_id: string;
  company_id: string;
  asset_type_id: number;
  asset_status_id: number;
  availability_status_id: number;
}

export interface Asset {
  id: string;
  noid?: string | null;
  name: string;
  model: string;
  serialNo: string;
  gmdn: string;
  budgetType?: string | null;
  acqType?: string | null;
  acqDoc?: string | null;
  price: string;
  disposalApprovedDate: string | null;
  warrantyDate: string;
  riskLevel: number | string;
  isMedicalDevice?: boolean;
  isSpecial?: boolean;
  isBackup?: boolean;
  pmType?: string | null;
  calType?: string | null;
  remark: string;
  imageUrl: string;
  receivedDate: string;
  section_id: string;
  company_id: string;
  asset_type_id: number;
  asset_status_id: number;
  availability_status_id: number;
  owner_id?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  status: {
    id: number;
    code: string;
    name: string;
  };
  availabilityStatus: {
    id: number;
    code: string;
    name: string;
  };
  type: {
    id: number;
    name: string;
  };
  section: {
    id: string;
    code: string;
    name: string;
    building: string;
  };
  company: {
    id: string;
    name: string;
  };
}
