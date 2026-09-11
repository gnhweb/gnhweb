import { createAuthClient } from '@neondatabase/auth';
import { SupabaseAuthAdapter } from '@neondatabase/auth/vanilla/adapters';

const DEFAULT_NEON_AUTH_URL = 'https://ep-empty-surf-az87wypd.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL || DEFAULT_NEON_AUTH_URL;

export const neon = {
  auth: createAuthClient(authUrl, {
    adapter: SupabaseAuthAdapter(),
    allowAnonymous: true,
  }),
};
