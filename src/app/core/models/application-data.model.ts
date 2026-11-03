import { AssetTypeRecord } from './asset-type.model';
import { ChecklistTemplate } from './checklist-template.model';
import { Defect } from './defect.model';
import { InspectionRecord } from './inspection.model';

export const APPLICATION_DATA_SCHEMA_VERSION = 1;

export interface ApplicationData {
  schemaVersion: number;
  assetTypes: AssetTypeRecord[];
  templates: ChecklistTemplate[];
  inspections: InspectionRecord[];
  defects: Defect[];
  recentlyUsedTemplateIds: string[];
}
