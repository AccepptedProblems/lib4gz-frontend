import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { OtpInputComponent } from './otp-input.component';

@Component({
  imports: [OtpInputComponent, ReactiveFormsModule],
  template: `<lib-otp-input [formControl]="code" (completed)="completed = $event" />`,
})
class HostComponent {
  code = new FormControl('', { nonNullable: true });
  completed = '';
}

describe('OtpInputComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let boxes: HTMLInputElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    boxes = Array.from(fixture.nativeElement.querySelectorAll('input'));
  });

  function type(index: number, value: string): void {
    boxes[index].focus();
    boxes[index].value = value;
    boxes[index].dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function press(index: number, key: string): void {
    boxes[index].focus();
    boxes[index].dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
    fixture.detectChanges();
  }

  it('renders six numeric boxes', () => {
    expect(boxes.length).toBe(6);
    expect(boxes.every(b => b.getAttribute('inputmode') === 'numeric')).toBeTrue();
  });

  it('typing a digit fills the box and moves focus to the next one', () => {
    type(0, '4');

    expect(host.code.value).toBe('4');
    expect(document.activeElement).toBe(boxes[1]);
  });

  it('ignores non-digits', () => {
    type(0, 'a');

    expect(host.code.value).toBe('');
    expect(boxes[0].value).toBe('');
  });

  it('backspace on an empty box clears the previous one and moves back', () => {
    type(0, '4');
    press(1, 'Backspace');

    expect(host.code.value).toBe('');
    expect(boxes[0].value).toBe('');
    expect(document.activeElement).toBe(boxes[0]);
  });

  it('pasting a code fills every box and reports completion', () => {
    const data = new DataTransfer();
    data.setData('text', '12 34 56');
    boxes[2].dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, cancelable: true }));
    fixture.detectChanges();

    expect(boxes.map(b => b.value).join('')).toBe('123456');
    expect(host.code.value).toBe('123456');
    expect(host.completed).toBe('123456');
  });

  it('a browser autofill that drops the whole code into one box spreads it out', () => {
    type(0, '987654');

    expect(boxes.map(b => b.value).join('')).toBe('987654');
    expect(host.completed).toBe('987654');
  });

  it('resetting the control clears the boxes', () => {
    type(0, '1');
    type(1, '2');

    host.code.reset();
    fixture.detectChanges();

    expect(boxes.map(b => b.value).join('')).toBe('');
  });
});
