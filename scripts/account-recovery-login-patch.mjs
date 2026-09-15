import fs from 'node:fs';

const path = 'src/hooks/useAuth.tsx';
const source = fs.readFileSync(path, 'utf8');

const anchor = "import { authenticateRegisteredPasskey, isPasskeySupported, signInWithPasskey as signInWithPasskeyLib } from '@/lib/passkey';";
const importLine = "import { migrateLegacyAccountPassword } from '@/lib/legacySupabaseAuth';";
if (!source.includes(anchor)) throw new Error('useAuth import anchor not found');
let next = source.includes(importLine) ? source : source.replace(anchor, `${anchor}\n${importLine}`);

const target = `      const { data, error } = await supabase.auth.signInWithPassword({ email, password });\n      if (error) return { error: error.message, user: null };`;
const replacement = `      let { data, error } = await supabase.auth.signInWithPassword({ email, password });\n\n      if (error) {\n        const migration = await migrateLegacyAccountPassword(email, password);\n        if (migration.migrated || migration.alreadyMigrated) {\n          ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));\n        }\n      }\n\n      if (error) return { error: error.message, user: null };`;
if (!next.includes(target)) throw new Error('signIn anchor not found');
next = next.replace(target, replacement);
fs.writeFileSync(path, next);
