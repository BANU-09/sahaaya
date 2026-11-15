// @vitest-environment jsdom
import React from 'react';
import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LocaleProvider, LanguageSelect } from '@/components/locale-provider';
import { Button, ErrorNotice, Status } from '@/components/ui';
declare const jsdom: { window: { localStorage: Storage } };
beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: jsdom.window.localStorage,
    configurable: true,
  });
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
describe('accessible interface components', () => {
  it('keeps busy actions disabled and labelled', () => {
    render(<Button busy>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
  it('exposes server errors as alerts', () => {
    render(
      <LocaleProvider>
        <ErrorNotice code="forbidden" />
      </LocaleProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('permission');
  });
  it('persists language and translates a dose status', () => {
    render(
      <LocaleProvider>
        <LanguageSelect />
        <Status value="TAKEN" />
      </LocaleProvider>,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'te' } });
    expect(window.localStorage.getItem('sahaaya-language')).toBe('te');
    expect(screen.getByText('తీసుకున్నట్లు నిర్ధారణ')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('te');
  });
});
