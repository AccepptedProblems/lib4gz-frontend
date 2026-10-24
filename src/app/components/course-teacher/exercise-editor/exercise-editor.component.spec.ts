import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ExerciseEditorComponent } from './exercise-editor.component';
import { ExerciseType } from '../../../shared/models';
import { ToastService } from '../../../shared/components/toast/toast.component';

const MC_PASTE = `Here you go:
1. Capital of France?
a) Berlin
*b) Paris
c) Rome

2. Largest planet?
a) Mars
b) Jupiter`;

describe('ExerciseEditorComponent Fast Create', () => {
  let fixture: ComponentFixture<ExerciseEditorComponent>;
  let component: ExerciseEditorComponent;
  let httpMock: HttpTestingController;
  let el: HTMLElement;
  let writeText: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExerciseEditorComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    writeText = jasmine.createSpy('writeText').and.returnValue(Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ExerciseEditorComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  function openSheet(type: ExerciseType): void {
    component.exerciseType.set(type);
    component.openFastCreate();
    fixture.detectChanges();
  }

  function paste(text: string): void {
    component.onFastCreateInput(text);
    tick(250);
    fixture.detectChanges();
  }

  function textOf(selector: string): string {
    return el.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it('parses a multiple-choice paste with options, stars and an intro line', fakeAsync(() => {
    openSheet(ExerciseType.MULTIPLE_CHOICE);
    paste(MC_PASTE);

    expect(component.parsedQuestions().length).toBe(2);
    expect(textOf('.fast-create-hint')).toBe('1 question has no correct answer marked.');
    expect(el.textContent).toContain('Add 2 Questions');

    component.confirmFastCreate();
    const qs = component.questions();
    expect(qs.map(q => q.content)).toEqual(['Capital of France?', 'Largest planet?']);
    expect(qs[0].meta['options']).toEqual([
      { text: 'Berlin', isCorrect: false },
      { text: 'Paris', isCorrect: true },
      { text: 'Rome', isCorrect: false },
    ]);
    expect(qs[1].meta['options'].some((o: any) => o.isCorrect)).toBeFalse();
    expect(component.showFastCreate()).toBeFalse();
  }));

  it('keeps written-answer pastes as plain questions with no options', fakeAsync(() => {
    openSheet(ExerciseType.TEXT_ANSWER);
    paste('1. Explain gravity\n2. Define mass');

    expect(el.querySelector('.fast-create-hint')).toBeNull();
    component.confirmFastCreate();
    expect(component.questions().map(q => q.meta)).toEqual([{}, {}]);
  }));

  it('shows the format of the chosen exercise type in the placeholder', () => {
    openSheet(ExerciseType.TEXT_ANSWER);
    expect(component.fastCreatePlaceholderText()).not.toContain('a)');
    openSheet(ExerciseType.MULTIPLE_CHOICE);
    expect(component.fastCreatePlaceholderText()).toContain('*b) Paris');
  });

  it('copies the prompt for the current type and confirms with a toast', fakeAsync(() => {
    const toast = TestBed.inject(ToastService);
    spyOn(toast, 'success');
    openSheet(ExerciseType.MULTIPLE_CHOICE);

    expect(textOf('.ai-prompt__title')).toBe('Let an AI write the questions for you.');
    expect(textOf('.ai-prompt__text')).toBe(
      'Copy the prompt, paste it into ChatGPT, Claude or Gemini, and add your topic. '
      + 'The reply comes back in the layout this box accepts. Paste it below.'
    );
    const button = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Copy AI prompt'))!;
    expect(button).toBeDefined();
    button.click();
    tick();

    const prompt: string = writeText.calls.mostRecent().args[0];
    expect(prompt).toContain('Put * in front of the correct option');
    expect(prompt).toContain('Material and instructions from the teacher:');
    expect(toast.success).toHaveBeenCalled();
  }));

  it('lets a multiple-choice question save with no correct answer marked', fakeAsync(() => {
    openSheet(ExerciseType.MULTIPLE_CHOICE);
    paste('1. Largest planet?\na) Mars\nb) Jupiter');
    component.confirmFastCreate();
    component.onTitleInput('Planets');

    component.saveExercise();

    expect(component.questionOptionErrors().size).toBe(0);
    expect(component.questionErrors().size).toBe(0);
  }));

  it('clicking the marked default option again clears it', () => {
    component.exerciseType.set(ExerciseType.MULTIPLE_CHOICE);
    expect(component.defaultOptions().some(o => o.isCorrect)).toBeFalse();
    component.setDefaultCorrectOption(1);
    expect(component.defaultOptions()[1].isCorrect).toBeTrue();
    component.setDefaultCorrectOption(1);
    expect(component.defaultOptions().some(o => o.isCorrect)).toBeFalse();
  });
});
