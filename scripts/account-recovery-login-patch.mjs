import fs from 'node:fs';

const path = 'src/pages/login/page.tsx';
const source = fs.readFileSync(path, 'utf8');

const authImport = "import { isPasskeySupported } from '@/lib/passkey';";
const migrationImport = "import { migrateLegacyAccountPassword } from '@/lib/legacySupabaseAuth';";
if (!source.includes(authImport)) throw new Error('login import anchor not found');
let next = source.includes(migrationImport) ? source : source.replace(authImport, `${authImport}\n${migrationImport}`);

const target = `        const { error: err, user: signedInUser } = await signIn(email, password);\n        if (signedInUser) {`;
const replacement = `        let { error: err, user: signedInUser } = await signIn(email, password);\n        if (!signedInUser && err) {\n          const migration = await migrateLegacyAccountPassword(email, password);\n          if (migration.migrated || migration.alreadyMigrated) {\n            ({ error: err, user: signedInUser } = await signIn(email, password));\n          }\n        }\n        if (signedInUser) {`;
if (!next.includes(target)) {
  if (next.includes(replacement)) process.exit(0);
  throw new Error('login submit anchor not found');
}
next = next.replace(target, replacement);
fs.writeFileSync(path, next);
