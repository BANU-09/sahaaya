'use client';
import { useEffect, useState } from 'react';
export class ClientError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers:
      body instanceof FormData
        ? undefined
        : body === undefined
          ? undefined
          : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ClientError(
      response.status >= 500 ? 'serviceUnavailable' : 'serverError',
      response.status,
    );
  }
  if (!response.ok)
    throw new ClientError(
      typeof data === 'object' && data !== null && 'error' in data
        ? String(data.error)
        : 'serverError',
      response.status,
    );
  return data as T;
}
export function useResource<T>(path: string | null, version = 0) {
  const key = `${path}:${version}`;
  const [state, setState] = useState<{
    key: string | null;
    path: string | null;
    data: T | null;
    error: string | null;
  }>({
    key: null,
    path: null,
    data: null,
    error: null,
  });
  useEffect(() => {
    if (!path) return;
    let active = true;
    api<T>(path)
      .then((data) => {
        if (active) setState({ key, path, data, error: null });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            key,
            path,
            data: null,
            error: error instanceof ClientError ? error.code : 'serverError',
          });
      });
    return () => {
      active = false;
    };
  }, [path, key]);
  return state.path === path && path
    ? {
        data: state.data,
        error: state.key === key ? state.error : null,
        loading: state.key !== key,
      }
    : { data: null, error: null, loading: Boolean(path) };
}
export type Serialized<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
export type PublicUser = {
  id: string;
  name: string;
  email: string | null;
  language: string;
  timezone: string;
  easyMode: boolean;
  demo: boolean;
  hasPin: boolean;
  emailVerified?: boolean;
  mobileVerified?: boolean;
  mfaEnabled?: boolean;
};
export type Me = { user: PublicUser; patients: { id: string; name: string; role: string }[] };
export type Config = {
  demo: boolean;
  integrations: Record<string, boolean>;
  emergencyNumber: string | null;
};
