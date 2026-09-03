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
  noid: string;
  name: string;
  model: string;
  serialNo: string;
  budgetType: string;
  acqType: string;
  price: string;
  acqDoc: string;
  warrantyDate: string;
  pmType: string;
  pmIntervalMonth: number;
  calType: string;
  calIntervalMonth: number;
  equipment_type_id: number;
  riskLevel: string;
  isSpecial: boolean;
  isBackup: boolean;
  remark: string;
  imageUrl: string;
  receivedDate: string;
  type_id: number;
  section_id: string;
  company_id: string;
  asset_status_id: number;
  availability_status_id: number;
  owner_id: string;
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
  equipmentType: {
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
  owner: {
    id: string;
    employeeId: string;
    firstname: string;
    lastname: string;
  };
  currentBorrowing: any | null;
}
