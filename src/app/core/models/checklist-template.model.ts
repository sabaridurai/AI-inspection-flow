export type ChecklistTemplateSource = 'SYSTEM' | 'AI_GENERATED' | 'USER_CREATED';
export type ChecklistTemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type ChecklistResponseType =
  | 'PASS_FAIL_NA'
  | 'YES_NO_NA'
  | 'TEXT'
  | 'NUMBER'
  | 'SINGLE_SELECT'
  | 'DATE'
  | 'PHOTO';
export type ChecklistSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ChecklistTemplateItem {
  id: string;
  question: string;
  instructions: string;
  responseType: ChecklistResponseType;
  severity: ChecklistSeverity;
  acceptanceCriteria: string;
  required: boolean;
  photoEvidenceRequired: boolean;
  displayOrder: number;
}

export interface ChecklistTemplateSection {
  id: string;
  title: string;
  description: string;
  displayOrder: number;
  items: ChecklistTemplateItem[];
}

export interface ChecklistTemplate {
  id: string;
  title: string;
  description: string;
  assetType: string;
  inspectionPurpose: string;
  source: ChecklistTemplateSource;
  version: number;
  status: ChecklistTemplateStatus;
  sections: ChecklistTemplateSection[];
  createdAt: string;
  updatedAt: string;
}

export interface NewChecklistTemplate {
  title: string;
  description: string;
  assetType: string;
  inspectionPurpose: string;
  sections: ChecklistTemplateSection[];
  source?: ChecklistTemplateSource;
}

export interface ChecklistTemplateFilters {
  search?: string;
  assetType?: string;
  status?: ChecklistTemplateStatus | 'ALL';
  source?: ChecklistTemplateSource | 'ALL';
}
