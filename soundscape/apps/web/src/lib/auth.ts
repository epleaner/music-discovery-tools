import { resolveApiUrl } from './trpc';

export interface AuthUser {
  id: string;
  username: string;
}

export interface AgentStatus {
  configured: boolean;
  connected: boolean;
  lastSeenAt: string | null;
}

const apiUrl = resolveApiUrl(import.meta.env?.VITE_API_URL);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(body?.message ?? 'Request failed.');
  }
  return body as T;
}

function jsonBody(value: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(value) };
}

export async function getSession(): Promise<AuthUser | null> {
  try {
    const result = await request<{ user: AuthUser }>('/auth/me');
    return result.user;
  } catch {
    return null;
  }
}

export async function register(
  username: string,
  password: string
): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>(
    '/auth/register',
    jsonBody({ username, password })
  );
  return result.user;
}

export async function login(
  username: string,
  password: string
): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>(
    '/auth/login',
    jsonBody({ username, password })
  );
  return result.user;
}

export async function logout(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' });
}

export function getAgentStatus(): Promise<AgentStatus> {
  return request<AgentStatus>('/auth/agent');
}

export async function generateAgentToken(): Promise<string> {
  const result = await request<{ token: string }>('/auth/agent', jsonBody({}));
  return result.token;
}

export async function revokeAgentToken(): Promise<void> {
  await request<void>('/auth/agent', { method: 'DELETE' });
}
