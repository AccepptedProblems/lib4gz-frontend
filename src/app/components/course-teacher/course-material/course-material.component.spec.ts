import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { of } from 'rxjs';
import { CourseMaterialComponent } from './course-material.component';
import { LessonResponse, ModuleResponse, SyllabusModule } from '../../../shared/models';
import { ToastService } from '../../../shared/components/toast/toast.component';
import { environment } from '../../../../environments/environment';

const API = `${environment.apiUrl}/v1`;

function lesson(id: string, moduleId: string, exerciseCount: number): LessonResponse {
  return { id, moduleId, title: `Lesson ${id}`, orderIndex: 0, hasSummary: false, exerciseCount, createdAt: 0, updatedAt: 0 };
}

function module(id: string, lessons: LessonResponse[]): SyllabusModule {
  return { id, courseId: 'crs_1', title: `Module ${id}`, orderIndex: 0, lessonCount: lessons.length, createdAt: 0, updatedAt: 0, lessons };
}

function moduleResponse(id: string, orderIndex: number): ModuleResponse {
  return { id, courseId: 'crs_1', title: `Module ${id}`, orderIndex, lessonCount: 0, createdAt: 0, updatedAt: 0 };
}

function drop(previousIndex: number, currentIndex: number): CdkDragDrop<unknown> {
  return { previousIndex, currentIndex } as CdkDragDrop<unknown>;
}

function mouse(target: EventTarget, type: string, x: number, y: number): void {
  // buttons and detail must be non-zero, or the CDK takes the press for a screen reader's.
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: 1, detail: 1 }));
}

/** Presses on `from`, moves in steps to the middle of `to`, and releases. Call inside fakeAsync. */
function pointerDrag(fixture: ComponentFixture<unknown>, from: Element, to: Element): void {
  const start = from.getBoundingClientRect();
  const end = to.getBoundingClientRect();
  const x = start.left + start.width / 2;
  const y = start.top + start.height / 2;
  const toY = end.top + end.height / 2 + 2;
  mouse(from, 'mousedown', x, y);
  for (let step = 1; step <= 10; step++) {
    mouse(document, 'mousemove', x, y + ((toY - y) * step) / 10);
    fixture.detectChanges();
  }
  mouse(document, 'mouseup', x, toY);
  flush();
  fixture.detectChanges();
}

describe('CourseMaterialComponent reorder and delete', () => {
  let fixture: ComponentFixture<CourseMaterialComponent>;
  let component: CourseMaterialComponent;
  let httpMock: HttpTestingController;
  let toast: ToastService;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.removeItem('user_id');
    await TestBed.configureTestingModule({
      imports: [CourseMaterialComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'crs_1' })) } },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(CourseMaterialComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();

    httpMock.expectOne(`${API}/courses/crs_1/syllabus`).flush({
      course: {},
      modules: [
        module('mod_a', [lesson('les_1', 'mod_a', 2), lesson('les_2', 'mod_a', 3), lesson('les_3', 'mod_a', 0)]),
        module('mod_b', []),
        module('mod_c', []),
      ],
    });
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  const moduleIds = () => component.modulesWithLessons().map(row => row.module.id);
  const lessonIds = () => component.modulesWithLessons()[0].lessons.map(l => l.id);
  const dialogText = () => el.querySelector('.delete-facts')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const deleteButton = () =>
    el.querySelector<HTMLButtonElement>('.dialog__actions lib-button:last-child button')!;

  it('moves a module at once, sends every module id in the new order, then keeps the server order', () => {
    component.dropModule(drop(0, 2));
    expect(moduleIds()).toEqual(['mod_b', 'mod_c', 'mod_a']);

    const req = httpMock.expectOne(`${API}/courses/crs_1/modules/order`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ moduleIds: ['mod_b', 'mod_c', 'mod_a'] });
    req.flush([moduleResponse('mod_b', 0), moduleResponse('mod_c', 1), moduleResponse('mod_a', 2)]);

    expect(moduleIds()).toEqual(['mod_b', 'mod_c', 'mod_a']);
    expect(component.modulesWithLessons()[2].lessons.length).toBe(3);
    expect(component.savingOrder()).toBeFalse();
  });

  it('sends nothing when a row is dropped where it started', () => {
    component.dropModule(drop(1, 1));
    component.dropLesson('mod_a', drop(2, 2));
    httpMock.expectNone(() => true);
    expect(moduleIds()).toEqual(['mod_a', 'mod_b', 'mod_c']);
  });

  it('sends nothing while a title is being edited', () => {
    component.startEditLesson('les_1', 'Lesson les_1');
    component.dropLesson('mod_a', drop(0, 1));
    httpMock.expectNone(() => true);
    expect(lessonIds()).toEqual(['les_1', 'les_2', 'les_3']);
  });

  it('puts the old lesson order back and shows the server text when the reorder fails', () => {
    component.dropLesson('mod_a', drop(0, 2));
    expect(lessonIds()).toEqual(['les_2', 'les_3', 'les_1']);

    const req = httpMock.expectOne(`${API}/modules/mod_a/lessons/order`);
    expect(req.request.body).toEqual({ lessonIds: ['les_2', 'les_3', 'les_1'] });
    const reason = 'The lessons of this module changed since the page was loaded. Refresh the page and try again.';
    req.flush({ errors: [{ reason }] }, { status: 400, statusText: 'Bad Request' });

    expect(lessonIds()).toEqual(['les_1', 'les_2', 'les_3']);
    expect(toast.messages().at(-1)?.text).toBe(reason);
    expect(component.savingOrder()).toBeFalse();
  });

  it('names what a module delete takes and keeps Delete off until the submission count arrives', () => {
    component.confirmDeleteModule(component.modulesWithLessons()[0]);
    fixture.detectChanges();

    expect(dialogText()).toContain('Its 3 lessons and 5 exercises will be deleted with it.');
    expect(dialogText()).toContain('Counting student submissions…');
    expect(dialogText()).toContain('The app cannot undo this.');
    expect(deleteButton().disabled).toBeTrue();

    httpMock.expectOne(`${API}/modules/mod_a?expand=submissionCount`).flush({ ...moduleResponse('mod_a', 0), submissionCount: 12 });
    fixture.detectChanges();

    expect(dialogText()).toContain('12 student submissions in this module, including drafts, will disappear too.');
    expect(deleteButton().disabled).toBeFalse();
  });

  it('still allows a lesson delete when the count cannot be read', () => {
    component.confirmDeleteLesson(component.modulesWithLessons()[0].lessons[0]);
    fixture.detectChanges();
    httpMock.expectOne(`${API}/lessons/les_1?expand=submissionCount`).flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(dialogText()).toContain('Its 2 exercises will be deleted with it.');
    expect(dialogText()).toContain('Any student submissions in this lesson will disappear too.');
    expect(deleteButton().disabled).toBeFalse();
  });

  it('names the summary a lesson delete erases', () => {
    component.confirmDeleteLesson({ ...lesson('les_9', 'mod_a', 2), hasSummary: true });
    fixture.detectChanges();
    expect(dialogText()).toContain('Its summary and 2 exercises will be deleted with it.');
    httpMock.expectOne(`${API}/lessons/les_9?expand=submissionCount`).flush({ submissionCount: 0 });

    component.confirmDeleteLesson(lesson('les_3', 'mod_a', 0));
    fixture.detectChanges();
    expect(dialogText()).toContain('It has no exercises.');
    httpMock.expectOne(`${API}/lessons/les_3?expand=submissionCount`).flush({ submissionCount: 0 });
  });

  it('unlocks dragging when the module holding a lesson edit is collapsed or deleted', () => {
    component.startEditLesson('les_1', 'Lesson les_1');
    component.toggleModule(0);
    expect(component.reorderLocked()).toBeFalse();

    component.toggleModule(0);
    component.startEditLesson('les_1', 'Lesson les_1');
    component.confirmDeleteModule(component.modulesWithLessons()[0]);
    httpMock.expectOne(`${API}/modules/mod_a?expand=submissionCount`).flush({ submissionCount: 0 });
    component.executeDelete();
    httpMock.expectOne(r => r.method === 'DELETE' && r.url === `${API}/modules/mod_a`).flush(null);
    expect(component.reorderLocked()).toBeFalse();
  });

  it('keeps a lesson added while a reorder was saving', () => {
    component.dropLesson('mod_a', drop(0, 2));
    const reorder = httpMock.expectOne(`${API}/modules/mod_a/lessons/order`);
    component.showAddLesson('mod_a');
    component.newLessonTitle.set('New');
    component.submitAddLesson('mod_a');
    httpMock.expectOne(r => r.method === 'POST' && r.url === `${API}/modules/mod_a/lessons`).flush(lesson('les_4', 'mod_a', 0));

    reorder.flush([lesson('les_2', 'mod_a', 3), lesson('les_3', 'mod_a', 0), lesson('les_1', 'mod_a', 2)]);
    expect(lessonIds()).toEqual(['les_2', 'les_3', 'les_1', 'les_4']);
  });

  it('moves a lesson one place with the arrow keys on its handle and keeps focus on it', fakeAsync(() => {
    const handles = () => el.querySelectorAll<HTMLButtonElement>('.lesson-row .drag-handle');
    const key = (target: Element, k: string) =>
      target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    key(handles()[0], 'ArrowUp');
    httpMock.expectNone(() => true);

    const second = handles()[1];
    second.focus();
    key(second, 'ArrowUp');
    const req = httpMock.expectOne(`${API}/modules/mod_a/lessons/order`);
    expect(req.request.body).toEqual({ lessonIds: ['les_2', 'les_1', 'les_3'] });
    req.flush([lesson('les_2', 'mod_a', 3), lesson('les_1', 'mod_a', 2), lesson('les_3', 'mod_a', 0)]);
    fixture.detectChanges();
    flush();

    expect(handles()[0]).toBe(second);
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute('aria-label')).toBe('Move Lesson: Lesson les_2. Arrow up or down moves it.');
  }));

  it('reorders only that module\'s lessons when a lesson is dragged by its handle', fakeAsync(() => {
    const rows = el.querySelectorAll('.lesson-row');
    pointerDrag(fixture, rows[0].querySelector('.drag-handle')!, rows[2]);

    httpMock.expectNone(`${API}/courses/crs_1/modules/order`);
    const req = httpMock.expectOne(`${API}/modules/mod_a/lessons/order`);
    expect(req.request.body).toEqual({ lessonIds: ['les_2', 'les_3', 'les_1'] });
    req.flush([lesson('les_2', 'mod_a', 3), lesson('les_3', 'mod_a', 0), lesson('les_1', 'mod_a', 2)]);
    fixture.detectChanges();

    const titles = Array.from(el.querySelectorAll('.lesson-title')).map(t => t.textContent!.replace(/\s+/g, ' ').trim());
    expect(titles).toEqual(['1.1 Lesson les_2', '1.2 Lesson les_3', '1.3 Lesson les_1']);
  }));

  it('starts no drag from a lesson title', fakeAsync(() => {
    const rows = el.querySelectorAll('.lesson-row');
    pointerDrag(fixture, rows[0].querySelector('.lesson-title')!, rows[2]);
    httpMock.expectNone(() => true);
    expect(lessonIds()).toEqual(['les_1', 'les_2', 'les_3']);
  }));
});
