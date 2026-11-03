import { ChecklistSeverity, ChecklistTemplate } from './checklist-template.model';

export type InspectionStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'REQUIRES_REPAIR';
export type InspectionResponseValue = string | number | boolean | null;

export interface InspectionResponse {
  id: string;
  checklistItemId: string;
  value: InspectionResponseValue;
  notes: string;
  evidenceImageIds: string[];
}

export interface InspectionAssetDetails {
  assetType: string;
  assetName: string;
  assetId: string;
  make: string;
  model: string;
  serialNumber: string;
  odometer: number | null;
  customDetails: Record<string, string>;
}

export interface InspectionRecord {
  id: string;
  title: string;
  templateId: string;
  templateTitle: string;
  templateSnapshot: ChecklistTemplate;
  asset: InspectionAssetDetails;
  inspectorName: string;
  inspectorEmail: string;
  inspectionDate: string;
  completionDate: string | null;
  status: InspectionStatus;
  responses: InspectionResponse[];
  notes: string;
  defectIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InspectionFailure {
  inspectionId: string;
  checklistItemId: string;
  description: string;
  severity: ChecklistSeverity;
  evidenceImageIds: string[];
}
