import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChecklistBuilder } from './checklist-builder';
import { appConfig } from '../../app.config';
import { Router } from '@angular/router';

describe('ChecklistBuilder', () => {
  let component: ChecklistBuilder;
  let fixture: ComponentFixture<ChecklistBuilder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistBuilder],
      providers: appConfig.providers,
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChecklistBuilder);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('navigates to the new inspection checklist generation flow', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.nativeElement.querySelector('.page-heading button').click();

    expect(navigate).toHaveBeenCalledWith(['/inspections'], { queryParams: { create: true } });
  });
});
