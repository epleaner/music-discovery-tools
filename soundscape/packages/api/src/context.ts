import type { db } from '@soundscape/db';

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
}

export interface Context {
  db: typeof db;
  user: AuthUser | null;
}



