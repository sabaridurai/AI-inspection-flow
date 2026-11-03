import { ChecklistSeverity } from './checklist-template.model';

export type DefectStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export interface Defect {
  id: string;
  inspectionId: string;
  checklistItemId: string;
  description: string;
  severity: ChecklistSeverity;
  evidenceImageIds: string[];
  recommendedAction: string;
  status: DefectStatus;
  assignedTo: string;
  targetCompletionDate: string | null;
  createdAt: string;
  updatedAt: string;
}
