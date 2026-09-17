import type { Company } from "../types/TypeAsset";
import axios from "axios";

export interface TrackRes {
  id: string;
  jobNo: string;
  assetId: string;
  sectionId: string;
  reporterId: string;
  jobTypeId: number;
  reportType: string;
  jobStatusId: number;
  companyId: string | null;
  billNo: string | null;
  diagnosis: string;
  symptom: string;
  solution: string;
  causeId: number;
  actionType: string;
  urgencyStatus: string;
  dueDate: string;
  returnDate: string | null;
  isRepeatRepair: boolean;
  techCategoryId: number;
  receiverId: string | null;
  warrantyDate: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;

  // Nested Objects (Inline)
  asset: {
    id: string;
    noid: string;
    name: string;
    model: string;
    serialNo: string;
    imageUrl: string;
  };

  section: {
    id: string;
    code: string;
    name: string;
  };

  reporter: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  };

  jobStatus: {
    id: number;
    code: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  };

  jobType: {
    id: number;
    name: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  };

  cause: {
    id: number;
    code: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    deleteAt: string | null;
  };

  techCategory: {
    id: number;
    code: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    deleteAt: string | null;
  };

  company: Company | null;

  mechanicRepairs: Array<{
    id: number;
    jobId: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
    deleteAt: string | null;
    user: {
      id: string;
      firstname: string;
      lastname: string;
      email: string;
    };
  }>;

  isOverdue: boolean;
  overdueDays: number;
}

export interface JobStatusLookup {
  id: number;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface JobTypeLookup {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CauseLookup {
  id: number;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deleteAt: string | null;
}

export interface TechCategoryLookup {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deleteAt: string | null;
}

export interface StepMasterLookup {
  id: number;
  stepNumber: number;
  actionType: string;
  label: string;
}

export interface RepairsLookupMeta {
  jobStatuses: JobStatusLookup[];
  jobTypes: JobTypeLookup[];
  causes: CauseLookup[];
  techCategories: TechCategoryLookup[];
  stepMasters: StepMasterLookup[];
}

export async function getRepairsHistory(
  sectionId?: string | number,
): Promise<TrackRes[]> {
  const token = localStorage.getItem("token");

  const res = await axios.get("https://hams-anntana.onrender.com/repairs", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      ...(sectionId && { sectionId }),
    },
  });

  return res.data.data;
}

export async function getLookUp(): Promise<RepairsLookupMeta> {
  const token = localStorage.getItem("token");

  const res = await axios.get(
    "https://hams-anntana.onrender.com/repairs/lookups/meta",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return res.data;
}
