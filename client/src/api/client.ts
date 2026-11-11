/**
 * Thin fetch wrapper for the PBL4_Web REST API.
 * - Sends cookies (session) on same-origin requests.
 * - Attaches the session-bound CSRF token to state-changing requests.
 * - Normalizes errors into ApiError { status, code, message, details }.
 */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string }[] };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let csrfToken: string | null = null;
export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(`/api${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url.pathname + url.search;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    body = options.body; // browser sets multipart boundary
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      credentials: 'include',
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối tới máy chủ. Vui lòng thử lại.');
  }

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? res.statusText, err?.details);
  }
  return data as T;
}

const FRIENDLY: Record<string, string> = {
  NETWORK_ERROR: 'Không thể kết nối tới máy chủ. Vui lòng thử lại.',
  UNAUTHENTICATED: 'Bạn cần đăng nhập để tiếp tục.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy nội dung yêu cầu.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
  EMAIL_TAKEN: 'E-mail này đã được đăng ký.',
  USERNAME_TAKEN: 'Tên người dùng đã có người sử dụng.',
  ACCOUNT_SUSPENDED: 'Tài khoản này đang bị tạm khoá.',
  INVALID_PASSWORD: 'Mật khẩu hiện tại không đúng.',
  CSRF_TOKEN_INVALID: 'Phiên làm việc không hợp lệ. Vui lòng tải lại trang.',
  INTERNAL_ERROR: 'Đã có lỗi xảy ra phía máy chủ.',
};

/** Human-readable (Vietnamese) message for any thrown error. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'UNAUTHENTICATED' && err.message === 'Invalid credentials') {
      return 'Sai e-mail/tên người dùng hoặc mật khẩu.';
    }
    if (err.code === 'VALIDATION_ERROR' && err.details?.length) {
      return err.details.map((d) => d.message).join(' · ');
    }
    return FRIENDLY[err.code] ?? err.message;
  }
  return 'Đã có lỗi xảy ra.';
}

/** Field → message map from a VALIDATION_ERROR response. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !err.details) return {};
  return Object.fromEntries(err.details.map((d) => [d.path, d.message]));
}
