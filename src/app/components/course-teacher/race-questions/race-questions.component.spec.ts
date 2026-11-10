import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { RaceQuestionsComponent } from './race-questions.component';
import { environment } from '../../../../environments/environment';
import { ModuleResponse, RaceQuestionResponse } from '../../../shared/models';

const COURSE = 'crs_1';
const QUESTIONS_URL = `${environment.apiUrl}/v1/courses/${COURSE}/race-questions`;
const MODULES_URL = `${environment.apiUrl}/v1/courses/${COURSE}/modules`;

const PASTE = `1. Capital of France?
a) Berlin
*b) Paris
c) Rome

2. Largest planet?
a) Mars
*b) Jupiter`;

function module(id: string, title: string): ModuleResponse {
  return { id, courseId: COURSE, title, orderIndex: 0, createdAt: 0, updatedAt: 0 };
}

function question(id: string, moduleId: string, content: string): RaceQuestionResponse {
  return { id, courseId: COURSE, moduleId, content, options: ['x', 'y'], correctIndex: 0, orderIndex: 0, createdAt: 0, updatedAt: 0 };
}

describe('RaceQuestionsComponent', () => {
  let fixture: ComponentFixture<RaceQuestionsComponent>;
  let component: RaceQuestionsComponent;
  let httpMock: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RaceQuestionsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: COURSE })) } },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RaceQuestionsComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  /** Answers the two loads that ngOnInit issued. */
  function load(questions: RaceQuestionResponse[] = []): void {
    httpMock.expectOne(MODULES_URL).flush([module('mod_a', 'Module A'), module('mod_b', 'Module B')]);
    httpMock.expectOne(QUESTIONS_URL).flush(questions);
    fixture.detectChanges();
  }

  function paste(text: string): void {
    component.bulkText.set(text);
    fixture.detectChanges();
    const add = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Add')!;
    add.click();
    fixture.detectChanges();
  }

  it('pasting two questions into module A adds two rows with A', () => {
    load();
    expect(component.bulkModuleId()).toBe('mod_a');

    paste(PASTE);

    const rows = component.rows();
    expect(rows.map(r => r.content)).toEqual(['Capital of France?', 'Largest planet?']);
    expect(rows.map(r => r.moduleId)).toEqual(['mod_a', 'mod_a']);
    expect(rows.map(r => r.id)).toEqual([null, null]);
    expect(rows[0].options).toEqual(['Berlin', 'Paris', 'Rome']);
    expect(rows[0].correctIndex).toBe(1);
    expect(component.bulkText()).toBe('');
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.querySelector('.add-warning')).toBeNull();
  });

  it('changing one row\'s select to B and saving sends B for that row', () => {
    load([question('rqn_1', 'mod_a', 'One'), question('rqn_2', 'mod_a', 'Two')]);

    const selects = el.querySelectorAll<HTMLSelectElement>('select.row-module');
    selects[1].value = 'mod_b';
    selects[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.isDirty()).toBeTrue();

    const save = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Save')!;
    save.click();
    fixture.detectChanges();

    const put = httpMock.expectOne(r => r.method === 'PUT' && r.url === QUESTIONS_URL);
    expect(put.request.body).toEqual({
      questions: [
        { id: 'rqn_1', moduleId: 'mod_a', content: 'One', options: ['x', 'y'], correctIndex: 0 },
        { id: 'rqn_2', moduleId: 'mod_b', content: 'Two', options: ['x', 'y'], correctIndex: 0 },
      ],
    });
    put.flush([question('rqn_1', 'mod_a', 'One'), question('rqn_2', 'mod_b', 'Two')]);
    fixture.detectChanges();

    expect(component.isDirty()).toBeFalse();
    expect(component.rows()[1].moduleId).toBe('mod_b');
  });

  /** Opens the drawer on row `index`. */
  function openRow(index: number): void {
    el.querySelectorAll<HTMLButtonElement>('button.question-table__open')[index].click();
    fixture.detectChanges();
  }

  function footerButton(label: string): HTMLButtonElement {
    return Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === label)!;
  }

  it('the drawer edits an option, the correct mark and adds one; Done writes the row, Save sends it', () => {
    load([question('rqn_1', 'mod_a', 'One')]);
    expect(document.querySelector('.side-sheet')).toBeNull();

    openRow(0);
    const optionInputs = document.querySelectorAll<HTMLInputElement>('input.options__input');
    optionInputs[1].value = 'yes';
    optionInputs[1].dispatchEvent(new Event('input'));
    const radios = document.querySelectorAll<HTMLInputElement>('input.options__radio');
    radios[1].checked = true;
    radios[1].dispatchEvent(new Event('change'));
    (document.querySelector('button.options__add') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.rows()[0].options).toEqual(['x', 'y']);

    footerButton('Done').click();
    fixture.detectChanges();
    expect(component.draftError()).toBe('Every option needs some text. Fill it in or remove it.');
    expect(component.editIndex()).toBe(0);

    const added = document.querySelectorAll<HTMLInputElement>('input.options__input')[2];
    added.value = 'maybe';
    added.dispatchEvent(new Event('input'));
    footerButton('Done').click();
    fixture.detectChanges();
    expect(component.editIndex()).toBe(-1);
    expect(component.rows()[0]).toEqual({ id: 'rqn_1', moduleId: 'mod_a', content: 'One', options: ['x', 'yes', 'maybe'], correctIndex: 1 });
    expect(el.querySelector('.question-table__answer')?.textContent?.trim()).toBe('yes');

    footerButton('Save').click();
    const put = httpMock.expectOne(r => r.method === 'PUT' && r.url === QUESTIONS_URL);
    expect(put.request.body).toEqual({
      questions: [{ id: 'rqn_1', moduleId: 'mod_a', content: 'One', options: ['x', 'yes', 'maybe'], correctIndex: 1 }],
    });
    put.flush([question('rqn_1', 'mod_a', 'One')]);
  });

  it('Cancel discards the draft; removing the correct option moves the mark to the first option', () => {
    load([{ ...question('rqn_1', 'mod_a', 'One'), options: ['x', 'y', 'z'], correctIndex: 2 }]);

    openRow(0);
    document.querySelectorAll<HTMLButtonElement>('button.icon-btn--small')[2].click();
    fixture.detectChanges();
    expect(component.draft()?.options).toEqual(['x', 'y']);
    expect(component.draft()?.correctIndex).toBe(0);
    expect(document.querySelectorAll('button.icon-btn--small').length).toBe(0);

    footerButton('Cancel').click();
    fixture.detectChanges();
    expect(component.rows()[0].options).toEqual(['x', 'y', 'z']);
    expect(component.isDirty()).toBeFalse();
  });

  it('a question with no * is refused with a warning', () => {
    load();

    paste('1. Largest planet?\na) Mars\nb) Jupiter');

    expect(component.rows()).toEqual([]);
    expect(el.querySelector('.add-warning')?.textContent?.trim())
      .toBe('1 question has no correct answer marked. The race needs one, so it was not added.');
    expect(component.bulkText()).toContain('Largest planet?');
  });
});
