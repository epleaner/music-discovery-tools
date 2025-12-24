import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { db } from '@soundscape/db';
import { createClient } from '@supabase/supabase-js';
import type { Context } from '@soundscape/api';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

let missingConfigWarningIssued = false;

const ensureSupabaseConfigured = () => {
  if (supabaseAdmin || missingConfigWarningIssued) {
    return;
  }

  missingConfigWarningIssued = true;
  console.warn(
    'Supabase admin client is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable authentication.'
  );
};

const resolveUser = async ({ req }: CreateExpressContextOptions): Promise<Context['user']> => {
  if (!supabaseAdmin) {
    ensureSupabaseConfigured();
    return null;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  const profile = data.user;

  try {
    await db.user.upsert({
      where: { id: profile.id },
      update: {
        email: profile.email,
        phone: profile.phone,
        lastSignIn: new Date(),
      },
      create: {
        id: profile.id,
        email: profile.email,
        phone: profile.phone,
      },
    });
  } catch (err) {
    console.error('Failed to sync Supabase user with database', err);
  }

  return {
    id: profile.id,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
  };
};

export const createContext = async (opts: CreateExpressContextOptions): Promise<Context> => {
  const user = await resolveUser(opts);

  return {
    db,
    user,
  };
};



