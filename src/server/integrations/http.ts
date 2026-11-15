import { ApiError } from '../errors';

/** Provider calls have a finite timeout and never expose credential-bearing error bodies. */
export async function checkedFetch(url: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new ApiError(503, 'serviceUnavailable');
  }
  if (!response.ok) throw new ApiError(502, 'providerError');
  return response;
}
