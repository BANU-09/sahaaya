// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { api, useResource } from '@/lib/client';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Resource({ path, version = 0 }: { path: string | null; version?: number }) {
  const state = useResource<{ name: string }>(path, version);
  return <div>{state.data?.name || (state.loading ? 'Loading' : 'No data')}</div>;
}
it('never shows a previous patient resource after the path changes', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'First patient' }) })
      .mockImplementation(() => new Promise(() => {})),
  );
  const view = render(<Resource path="patients/first" />);
  expect(await screen.findByText('First patient')).toBeInTheDocument();
  view.rerender(<Resource path="patients/second" />);
  expect(screen.queryByText('First patient')).not.toBeInTheDocument();
  expect(screen.getByText('Loading')).toBeInTheDocument();
  view.rerender(<Resource path={null} />);
  expect(screen.getByText('No data')).toBeInTheDocument();
});
it('keeps an existing view mounted while refreshing the same resource', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'Current patient' }) })
      .mockImplementation(() => new Promise(() => {})),
  );
  const view = render(<Resource path="patients/current" />);
  expect(await screen.findByText('Current patient')).toBeInTheDocument();
  await act(async () => view.rerender(<Resource path="patients/current" version={1} />));
  expect(screen.getByText('Current patient')).toBeInTheDocument();
});
it('turns a non-JSON gateway error into a useful service error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status: 502,
      ok: false,
      json: async () => {
        throw new SyntaxError('HTML');
      },
    }),
  );
  await expect(api('config')).rejects.toMatchObject({ code: 'serviceUnavailable', status: 502 });
});
