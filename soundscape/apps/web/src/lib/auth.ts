import { resolveApiUrl } from './trpc';

export interface SessionUser {
  id: string;
}

export interface AgentStatus {
  configured: boolean;
  connected: boolean;
  lastSeenAt: string | null;
}

const apiUrl = resolveApiUrl(import.meta.env?.VITE_API_URL);

export async function preparePairingPassphrase(
  passphrase?: string
): Promise<string> {
  const result = await request<{ passphrase: string }>(
    '/auth/passphrase',
    jsonBody(passphrase === undefined ? {} : { passphrase })
  );
  return result.passphrase;
}

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

export async function getSession(): Promise<SessionUser | null> {
  try {
    const result = await request<{ user: SessionUser }>('/auth/session');
    return result.user;
  } catch {
    return null;
  }
}

export async function startSession(passphrase: string): Promise<SessionUser> {
  const preparedPassphrase = await preparePairingPassphrase(passphrase);
  const result = await request<{ user: SessionUser }>(
    '/auth/session',
    jsonBody({ passphrase: preparedPassphrase })
  );
  return result.user;
}

export async function logout(): Promise<void> {
  await request<void>('/auth/session', { method: 'DELETE' });
}

export function getAgentStatus(): Promise<AgentStatus> {
  return request<AgentStatus>('/auth/agent');
}

export async function pairAgent(passphrase: string): Promise<void> {
  const preparedPassphrase = await preparePairingPassphrase(passphrase);
  await request<void>(
    '/auth/agent',
    jsonBody({ passphrase: preparedPassphrase })
  );
}
