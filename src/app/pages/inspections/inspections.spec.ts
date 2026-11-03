import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Inspections } from './inspections';
import { appConfig } from '../../app.config';
import { Ai } from '../../services/ai';
import { ChecklistTemplateService } from '../../core/services/checklist-template.service';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

describe('Inspections', () => {
  let component: Inspections;
  let fixture: ComponentFixture<Inspections>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Inspections],
      providers: appConfig.providers,
    })
    .compileComponents();

    fixture = TestBed.createComponent(Inspections);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens the checklist generation form when launched from the template library', async () => {
    fixture.destroy();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Inspections],
      providers: [
        ...appConfig.providers,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ create: 'true' }) } },
        },
      ],
    }).compileComponents();

    const inspectionFixture = TestBed.createComponent(Inspections);
    await inspectionFixture.whenStable();

    expect(inspectionFixture.componentInstance.creating()).toBe(true);
    expect(inspectionFixture.nativeElement.textContent).toContain('Checklist generation');
  });

  it('accepts a custom asset type as text', () => {
    component.inspectionForm.controls.assetType.setValue('Hydraulic freight elevator');

    expect(component.inspectionForm.controls.assetType.value).toBe('Hydraulic freight elevator');
    expect(component.inspectionForm.controls.assetType.valid).toBe(true);
  });

  it('asks for required asset details without requesting checklist questions', () => {
    const getChecklistQuestions = vi.spyOn(TestBed.inject(Ai), 'getChecklistQuestions');

    component.requestChecklistQuestions();

    expect(component.aiError()).toBe('Please enter all required asset details before getting checklist questions.');
    expect(component.inspectionForm.controls.assetType.touched).toBe(true);
    expect(getChecklistQuestions).not.toHaveBeenCalled();
    expect(component.checklistLoading()).toBe(false);
  });

  it('lets the user edit generated points and save them for reuse', () => {
    component.inspectionForm.controls.assetType.setValue('Hydraulic freight elevator');
    component.generatedChecklist.set([{
      title: 'Door safety',
      items: ['Check door interlock'],
    }]);
    component.templateTitle.set('Elevator door inspection');

    component.addChecklistPoint(0);
    const inputEvent = new Event('input');
    Object.defineProperty(inputEvent, 'target', { value: { value: 'Test obstruction sensor' } });
    component.updateChecklistItem(0, 1, inputEvent);
    component.saveGeneratedTemplate();

    const savedTemplate = TestBed.inject(ChecklistTemplateService).getTemplates({
      source: 'AI_GENERATED',
    }).find((template) => template.title === 'Elevator door inspection');

    expect(savedTemplate?.sections[0].items.map((item) => item.question)).toEqual([
      'Check door interlock',
      'Test obstruction sensor',
    ]);
    expect(component.templateSaveMessage()).toBe('Saved to the reusable checklist library.');
    component.selectedTemplateId.set(savedTemplate!.id);
    component.applyReusableTemplate();
    expect(component.generatedChecklist()).toEqual([{
      title: 'Door safety',
      items: ['Check door interlock', 'Test obstruction sensor'],
    }]);
  });

  it('moves a checklist point into a different section', () => {
    component.generatedChecklist.set([
      { title: 'Door safety', items: ['Check interlock'] },
      { title: 'Controls', items: ['Test emergency stop'] },
    ]);
    const changeEvent = new Event('change');
    Object.defineProperty(changeEvent, 'target', { value: { value: '1' } });

    component.moveChecklistPoint(0, 0, changeEvent);

    expect(component.generatedChecklist()).toEqual([
      { title: 'Door safety', items: [] },
      { title: 'Controls', items: ['Test emergency stop', 'Check interlock'] },
    ]);
    expect(component.checklistReady()).toBe(false);
  });
});
