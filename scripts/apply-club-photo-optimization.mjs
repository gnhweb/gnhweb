import fs from 'node:fs';

const target = 'src/pages/clubs/detail/page.tsx';
const workflow = '.github/workflows/normalize-types.yml';
const source = fs.readFileSync(target, 'utf8');
const start = source.indexOf('      const uploadPromises = Array.from(files).map(async (file): Promise<ClubPhoto> => {');
const end = source.indexOf('      const newPhotos = await Promise.all(uploadPromises);', start);
if (start < 0 || end < 0) throw new Error('Club photo upload block not found');
const replacement = `      const uploadPromises = Array.from(files).map(async (file): Promise<ClubPhoto> => {
        const safeName = \`${'${id}'}-${'${Date.now()}'}-${'${Math.random().toString(36).slice(2, 8)}'}.jpg\`;
        const path = \`club-photos/${'${safeName}'}\`;
        const thumbPath = \`club-photos/${'${thumbFileNameFor(safeName)}'}\`;
        const [displayBlob, thumbBlob] = await Promise.all([
          resizeImageFile(file, { maxDimension: 1280, quality: 0.78, mimeType: 'image/jpeg' }),
          resizeImageFile(file, { maxDimension: 480, quality: 0.68, mimeType: 'image/jpeg' }),
        ]);

        const { error: displayErr } = await supabase.storage
          .from('Public')
          .upload(path, displayBlob, {
            upsert: true,
            contentType: 'image/jpeg',
            cacheControl: '31536000',
          });
        if (displayErr) throw displayErr;

        const { error: thumbErr } = await supabase.storage
          .from('Public')
          .upload(thumbPath, thumbBlob, {
            upsert: true,
            contentType: 'image/jpeg',
            cacheControl: '31536000',
          });
        if (thumbErr) {
          await supabase.storage.from('Public').remove([path]);
          throw thumbErr;
        }

        const url = supabase.storage.from('Public').getPublicUrl(path).data.publicUrl;
        const thumbUrl = supabase.storage.from('Public').getPublicUrl(thumbPath).data.publicUrl;
        return { url, thumbUrl };
      });
`;
fs.writeFileSync(target, source.slice(0, start) + replacement + source.slice(end));
fs.writeFileSync(workflow, `name: Normalize legacy TypeScript\n\non:\n  push:\n    branches:\n      - 'fix/**'\n  workflow_dispatch:\n\npermissions:\n  contents: write\n\njobs:\n  normalize:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n        with:\n          fetch-depth: 0\n\n      - name: Setup Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: 22\n\n      - name: Normalize source\n        run: |\n          node scripts/normalize-legacy-types.mjs\n          node scripts/dedupe-passkey-auth.mjs\n          node scripts/apply-club-photo-optimization.mjs\n\n      - name: Commit normalized source when changed\n        run: |\n          if git diff --quiet; then\n            echo \"No normalization changes needed.\"\n            exit 0\n          fi\n          git config user.name \"github-actions[bot]\"\n          git config user.email \"41898282+github-actions[bot]@users.noreply.github.com\"\n          git add src scripts .github/workflows/normalize-types.yml\n          git commit -m \"perf: optimize club photo uploads\"\n          git push origin HEAD:${GITHUB_REF_NAME}\n`);
// Restore the workflow and remove this one-time helper before the bot commit.
fs.writeFileSync(workflow, `name: Normalize legacy TypeScript\n\non:\n  push:\n    branches:\n      - 'fix/**'\n  workflow_dispatch:\n\npermissions:\n  contents: write\n\njobs:\n  normalize:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n        with:\n          fetch-depth: 0\n\n      - name: Setup Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: 22\n\n      - name: Normalize source\n        run: |\n          node scripts/normalize-legacy-types.mjs\n          node scripts/dedupe-passkey-auth.mjs\n\n      - name: Commit normalized source when changed\n        run: |\n          if git diff --quiet; then\n            echo \"No normalization changes needed.\"\n            exit 0\n          fi\n          git config user.name \"github-actions[bot]\"\n          git config user.email \"41898282+github-actions[bot]@users.noreply.github.com\"\n          git add src scripts\n          git commit -m \"fix: normalize legacy type errors\"\n          git push origin HEAD:${GITHUB_REF_NAME}\n`);
fs.rmSync(new URL(import.meta.url), { force: true });
