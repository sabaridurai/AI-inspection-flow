import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { Ai, ChecklistGenerationRequest } from './ai';

describe('Ai', () => {
  let service: Ai;
  let http: HttpTestingController;

  const inspection: ChecklistGenerationRequest = {
    assetType: 'Elevator',
    asset: 'Freight Elevator',
    location: 'North Tower',
    inspector: 'Taylor',
    date: '2026-10-30',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Ai);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests AI-generated questions using the inspection form details', () => {
    service.getChecklistQuestions(inspection).subscribe((response) => {
      expect(response.questions[0].label).toBe('Drive type');
    });

    const request = http.expectOne(`${environment.apiBaseUrl}/ai/checklist/questions`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(inspection);
    request.flush({ questions: [{ key: 'driveType', label: 'Drive type', options: ['Traction'] }] });
  });

  it('sends generated answers and inspection details to create a checklist', () => {
    const answers = [{ label: 'Drive type', value: 'Traction' }];
    service.generateChecklist(inspection, answers).subscribe((response) => {
      expect(response.sections).toEqual([{
        title: 'Drive system',
        items: ['Inspect the drive system'],
      }]);
    });

    const request = http.expectOne(`${environment.apiBaseUrl}/ai/checklist`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ ...inspection, answers });
    request.flush({ sections: [{ title: 'Drive system', items: ['Inspect the drive system'] }] });
  });
});
