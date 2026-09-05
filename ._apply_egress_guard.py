from pathlib import Path
import re


def edit(path: str, fn):
    p = Path(path)
    s = p.read_text()
    s = fn(s)
    p.write_text(s)


def need(condition: bool, path: str, label: str):
    if not condition:
        raise SystemExit(f'missing expected source in {path}: {label}')


def add_import(s: str, imp: str) -> str:
    if imp in s:
        return s
    return s.replace("import { supabase } from '@/lib/supabase';", "import { supabase } from '@/lib/supabase';\n" + imp, 1)

# Remove the Supabase -> wsrv.nl image proxy from the service worker.
def sw(s: str) -> str:
    s2, n = re.subn(r"const SUPABASE_STORAGE_HOST = .*?self\.addEventListener\('push'", "self.addEventListener('push'", s, count=1, flags=re.S)
    need(n == 1 and 'wsrv.nl' not in s2, 'src/sw.ts', 'storage proxy block')
    return s2
edit('src/sw.ts', sw)

# Reject oversized output instead of ever falling back to an original.
def resize(s: str) -> str:
    old = "  mimeType?: string;\n}\n"
    new = "  mimeType?: string;\n  maxBytes?: number;\n}\n"
    need(old in s, 'src/lib/imageResize.ts', 'resize options')
    s = s.replace(old, new, 1)
    s = s.replace('const DEFAULTS: Required<ResizeOptions> = {', "const DEFAULTS: Required<Omit<ResizeOptions, 'maxBytes'>> = {", 1)
    s = re.sub(r"\nconst MAX_ORIGINAL_FALLBACK_BYTES = .*?;\n", "\n", s, count=1)
    s = re.sub(r"\nfunction isJpegFile\(source: File \| Blob\): boolean \{.*?\n\}\n", "\n", s, count=1, flags=re.S)
    s = re.sub(r"\n  try \{\n    drawableResult = await loadDrawable\(source\);\n  \} catch \(error\) \{.*?\n  \}\n", "\n  drawableResult = await loadDrawable(source);\n", s, count=1, flags=re.S)
    old = "    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));\n    if (!blob) throw new Error(`[IMAGE_ENCODE_ERROR] ${sourceDescription(source)} | mime=${mimeType} quality=${quality}`);\n    return blob;"
    new = "    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));\n    if (!blob) throw new Error(`[IMAGE_ENCODE_ERROR] ${sourceDescription(source)} | mime=${mimeType} quality=${quality}`);\n    if (options.maxBytes && blob.size > options.maxBytes) {\n      throw new Error(`[IMAGE_SIZE_LIMIT_ERROR] ${sourceDescription(source)} | output=${blob.size} max=${options.maxBytes}`);\n    }\n    return blob;"
    need(old in s, 'src/lib/imageResize.ts', 'encoded blob')
    return s.replace(old, new, 1)
edit('src/lib/imageResize.ts', resize)

edit('src/components/feature/ClubBannerManager.tsx', lambda s: add_import(s, "import { resizeImageFile } from '@/lib/imageResize';").replace(
    "const { error: uploadErr } = await supabase.storage.from('Public').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });",
    "const optimizedBlob = await resizeImageFile(blob, { maxDimension: type === 'hero' ? 1280 : 800, quality: 0.76, mimeType: 'image/jpeg', maxBytes: type === 'hero' ? 350 * 1024 : 220 * 1024 });\n      const { error: uploadErr } = await supabase.storage.from('Public').upload(path, optimizedBlob, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });", 1))

edit('src/components/feature/SiteBanner.tsx', lambda s: add_import(s, "import { resizeImageFile } from '@/lib/imageResize';").replace(
    "const { error: uploadErr } = await supabase.storage.from('Public').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });",
    "const optimizedBlob = await resizeImageFile(blob, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 });\n      const { error: uploadErr } = await supabase.storage.from('Public').upload(path, optimizedBlob, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });", 1))

edit('src/pages/profile/page.tsx', lambda s: add_import(s, "import { resizeImageFile } from '@/lib/imageResize';").replace(
    "const ext = file.name.split('.').pop();\n      const path = `avatars/${user.id}-${Date.now()}.${ext}`;\n      const { error: uploadErr } = await supabase.storage.from('Public').upload(path, file, { upsert: true });",
    "const optimizedFile = await resizeImageFile(file, { maxDimension: 512, quality: 0.74, mimeType: 'image/jpeg', maxBytes: 120 * 1024 });\n      const path = `avatars/${user.id}-${Date.now()}.jpg`;\n      const { error: uploadErr } = await supabase.storage.from('Public').upload(path, optimizedFile, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });", 1))


def community(s: str) -> str:
    s = add_import(s, "import { resizeImageFile } from '@/lib/imageResize';")
    pattern = r"      let imageUrls: string\[\] = \[\];\n\n      // Upload images first\n      if \(postImages\.length > 0\) \{.*?\n      \}\n\n      const payload = \{"
    repl = (
        "      let imageUrls: string[] = [];\n"
        "      const uploadedPaths: string[] = [];\n\n"
        "      if (postImages.length > 0) {\n"
        "        setUploadingImages(true);\n"
        "        try {\n"
        "          for (const file of postImages) {\n"
        "            const optimizedFile = await resizeImageFile(file, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 });\n"
        "            const path = `club-posts/${clubId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;\n"
        "            const { error: uploadErr } = await supabase.storage.from('Public').upload(path, optimizedFile, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });\n"
        "            if (uploadErr) throw uploadErr;\n"
        "            uploadedPaths.push(path);\n"
        "            const { data: urlData } = supabase.storage.from('Public').getPublicUrl(path);\n"
        "            imageUrls.push(urlData.publicUrl);\n"
        "          }\n"
        "        } catch (uploadError) {\n"
        "          if (uploadedPaths.length) await supabase.storage.from('Public').remove(uploadedPaths);\n"
        "          throw uploadError;\n"
        "        } finally {\n"
        "          setUploadingImages(false);\n"
        "        }\n"
        "      }\n\n"
        "      const payload = {"
    )
    s2, n = re.subn(pattern, repl, s, count=1, flags=re.S)
    need(n == 1, 'src/pages/clubs/community/page.tsx', 'image upload block')
    return s2.replace("      if (insertError) {\n        console.error('[ClubCommunity] post insert failed:', insertError, payload);", "      if (insertError) {\n        if (uploadedPaths.length) await supabase.storage.from('Public').remove(uploadedPaths);\n        console.error('[ClubCommunity] post insert failed:', insertError, payload);", 1)
edit('src/pages/clubs/community/page.tsx', community)


def story(s: str) -> str:
    s = add_import(s, "import { resizeImageFile } from '@/lib/imageResize';")
    s = s.replace("const ext = uploadFile.name.split('.').pop() || 'jpg';", "const ext = 'jpg';", 1)
    s = s.replace("const ext = editUploadFile.name.split('.').pop() || 'jpg';", "const ext = 'jpg';", 1)
    s = s.replace("supabase.storage.from('Public').upload(path, uploadFile, { upsert: true })", "supabase.storage.from('Public').upload(path, await resizeImageFile(uploadFile, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 }), { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' })", 1)
    s = s.replace("supabase.storage.from('Public').upload(path, editUploadFile, { upsert: true })", "supabase.storage.from('Public').upload(path, await resizeImageFile(editUploadFile, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 }), { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' })", 1)
    return s
edit('src/pages/faithStorybook/page.tsx', story)

for path in ['src/pages/ganghakNews/write/page.tsx', 'src/pages/ganghakNews/edit/page.tsx']:
    edit(path, lambda s: add_import(s, "import { resizeImageFile } from '@/lib/imageResize';")
        .replace("const ext = file.name.split('.').pop();", "const ext = 'jpg';", 1)
        .replace("supabase.storage.from('Public').upload(path, file, { upsert: true })", "supabase.storage.from('Public').upload(path, await resizeImageFile(file, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 }), { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' })", 1))

edit('src/pages/missions/board/page.tsx', lambda s: add_import(s, "import { resizeImageFile } from '@/lib/imageResize';").replace(
    "const fileExt = proofFile.name.split('.').pop() || 'jpg'; const filePath = `missions/proof/${proofAssignmentId}_${Date.now()}.${fileExt}`; uploadedFilePath = filePath; const { error: uploadErr } = await supabase.storage.from('Public').upload(filePath, proofFile, { cacheControl: '3600', upsert: false });",
    "const filePath = `missions/proof/${proofAssignmentId}_${Date.now()}.jpg`; uploadedFilePath = filePath; const optimizedProof = await resizeImageFile(proofFile, { maxDimension: 960, quality: 0.74, mimeType: 'image/jpeg', maxBytes: 300 * 1024 }); const { error: uploadErr } = await supabase.storage.from('Public').upload(filePath, optimizedProof, { cacheControl: '31536000', contentType: 'image/jpeg', upsert: false });", 1))

edit('src/pages/memoryBoard/page.tsx', lambda s: s.replace("resizeImageFile(uploadFile, { maxDimension: 1280, quality: 0.78, mimeType: 'image/jpeg' })", "resizeImageFile(uploadFile, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 })", 1).replace("resizeImageFile(uploadFile, { maxDimension: 480, quality: 0.68, mimeType: 'image/jpeg' })", "resizeImageFile(uploadFile, { maxDimension: 480, quality: 0.68, mimeType: 'image/jpeg', maxBytes: 90 * 1024 })", 1))
edit('src/pages/clubs/detail/page.tsx', lambda s: s.replace("resizeImageFile(file, { maxDimension: 1280, quality: 0.78, mimeType: 'image/jpeg' })", "resizeImageFile(file, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 })", 1).replace("resizeImageFile(file, { maxDimension: 480, quality: 0.68, mimeType: 'image/jpeg' })", "resizeImageFile(file, { maxDimension: 480, quality: 0.68, mimeType: 'image/jpeg', maxBytes: 90 * 1024 })", 1))

Path('supabase/migrations/20260905220000_harden_public_image_bucket.sql').write_text("-- Public image bucket guard\nupdate storage.buckets\nset file_size_limit = 524288, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]\nwhere id = 'Public';\n")
