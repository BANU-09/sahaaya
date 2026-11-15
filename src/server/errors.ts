import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof ApiError)
    return Response.json({ error: error.code }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError)
    return Response.json({ error: 'invalidInput' }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') return Response.json({ error: 'conflict' }, { status: 409 });
    if (error.code === 'P2002') return Response.json({ error: 'conflict' }, { status: 409 });
    if (error.code === 'P2025') return Response.json({ error: 'notFound' }, { status: 404 });
    const adapter = error.meta?.driverAdapterError as
      { cause?: { originalCode?: string; kind?: string } } | undefined;
    console.error(
      'database_request_failed',
      error.code,
      error.meta?.code,
      adapter?.cause?.originalCode,
      adapter?.cause?.kind,
    );
  }
  // Error type only: do not log requests, credentials, SQL parameters, or health records.
  console.error('request_failed', error instanceof Error ? error.name : 'UnknownError');
  return Response.json({ error: 'serverError' }, { status: 500 });
}
export async function readText(request: Request, maximumBytes: number) {
  if (Number(request.headers.get('content-length')) > maximumBytes)
    throw new ApiError(413, 'tooLarge');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel();
        throw new ApiError(413, 'tooLarge');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}
export async function readJson(request: Request): Promise<unknown> {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    throw new ApiError(415, 'invalidInput');
  const raw = await readText(request, 32_768);
  return JSON.parse(raw);
}
