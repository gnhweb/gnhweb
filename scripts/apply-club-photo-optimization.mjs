import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

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
const originalWorkflow = execFileSync('git', ['show', '743bfb600ab223bcacf9345d6844770095ea3373:.github/workflows/normalize-types.yml'], { encoding: 'utf8' });
fs.writeFileSync(workflow, originalWorkflow);
fs.rmSync(new URL(import.meta.url), { force: true });
