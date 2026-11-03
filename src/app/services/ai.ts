import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChecklistGenerationQuestion {
  key: string;
  label: string;
  options?: string[];
}

export interface ChecklistGenerationAnswer {
  label: string;
  value: string;
}

export interface ChecklistGenerationSection {
  title: string;
  items: string[];
}

export interface ChecklistGenerationRequest {
  assetType: string;
  asset: string;
  location: string;
  inspector: string;
  date: string;
}

interface ChecklistQuestionsResponse {
  questions: ChecklistGenerationQuestion[];
}

export interface ChecklistItemsResponse {
  sections: ChecklistGenerationSection[];
}

@Injectable({
  providedIn: 'root',
})
export class Ai {
  private readonly http = inject(HttpClient);

  getChecklistQuestions(request: ChecklistGenerationRequest): Observable<ChecklistQuestionsResponse> {
    return this.http.post<ChecklistQuestionsResponse>(
      `${environment.apiBaseUrl}/ai/checklist/questions`,
      request,
    );
  }

  generateChecklist(
    request: ChecklistGenerationRequest,
    answers: ChecklistGenerationAnswer[],
  ): Observable<ChecklistItemsResponse> {
    return this.http.post<ChecklistItemsResponse>(
      `${environment.apiBaseUrl}/ai/checklist`,
      { ...request, answers },
    );
  }
}
