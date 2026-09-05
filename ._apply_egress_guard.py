from pathlib import Path

ROOT = Path('.')

def edit(path: str, replacements: list[tuple[str, str]]) -> None:
    p = ROOT / path
    s = p.read_text()
    for old, new in replacements:
        if old not in s:
            raise SystemExit(f'missing expected source in {path}: {old[:120]!r}')
        s = s.replace(old, new, 1)
    p.write_text(s)

edit('src/sw.ts', [
("""const SUPABASE_STORAGE_HOST = 'ceearwcfvcbjhmkuuqzv.supabase.co';
const SUPABASE_PUBLIC_OBJECT_PATH = '/storage/v1/object/public/';
const IMAGE_PROXY_HOST = 'https://wsrv.nl/';
const OPTIMIZED_IMAGE_CACHE = 'gnh-optimized-storage-images-v3';

function toOptimizedStorageImage(request: Request): Request | null {
  if (request.method !== 'GET') return null;

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }

  if (url.hostname !== SUPABASE_STORAGE_HOST || !url.pathname.startsWith(SUPABASE_PUBLIC_OBJECT_PATH)) {
    return null;
  }

  // 이미 클라이언트에서 480px 이하로 만든 썸네일은 다시 프록시하지 않는다.
  // 작은 썸네일을 Supabase에서 직접 받아 불필요한 wsrv 원본 재조회도 막는다.
  const path = decodeURIComponent(url.pathname);
  const isThumbnail = /\\/thumb_[^/]+\\.jpg$/i.test(path);
  if (isThumbnail) return null;

  const proxyUrl = new URL(IMAGE_PROXY_HOST);
  proxyUrl.searchParams.set('url', url.href);
  // 모바일 카드/리스트 표시 기준으로 충분한 최대 폭만 요청해 원본 변환량을 줄인다.
  proxyUrl.searchParams.set('w', '960');
  proxyUrl.searchParams.set('we', '');
  proxyUrl.searchParams.set('output', 'webp');
  proxyUrl.searchParams.set('q', '68');
  proxyUrl.searchParams.set('maxage', '1y');

  return new Request(proxyUrl.href, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    redirect: 'follow',
  });
}

async function getOptimizedStorageResponse(request: Request, optimizedRequest: Request): Promise<Response> {
  const cache = await caches.open(OPTIMIZED_IMAGE_CACHE);
  const cached = await cache.match(optimizedRequest);
  if (cached) return cached;

  try {
    const response = await fetch(optimizedRequest);
    if (response.ok) {
      try {
        await cache.put(optimizedRequest, response.clone());
      } catch {
        // Browser cache quota or private-mode restrictions must not break images.
      }
    }
    return response;
  } catch {
    return fetch(request);
  }
}

self.addEventListener('fetch', (event) => {
  const optimizedRequest = toOptimizedStorageImage(event.request);
  if (!optimizedRequest) return;

  event.respondWith(getOptimizedStorageResponse(event.request, optimizedRequest));
});

", ""),
])

edit('src/lib/imageResize.ts', [
("""  /** 출력 MIME 타입 (기본 image/jpeg — 투명도가 필요 없는 사진에 가장 작은 용량) */
  mimeType?: string;
}

const DEFAULTS: Required<ResizeOptions> = {
  maxDimension: 480,
  quality: 0.72,
  mimeType: 'image/jpeg',
};

const MAX_ORIGINAL_FALLBACK_BYTES = 2 * 1024 * 1024;
""", """  /** 출력 MIME 타입 (기본 image/jpeg — 투명도가 필요 없는 사진에 가장 작은 용량) */
  mimeType?: string;
  /** 출력 Blob의 최대 바이트 수. 지정하면 품질/크기를 자동으로 낮춰 상한을 맞춘다. */
  maxBytes?: number;
}

const DEFAULTS = {
  maxDimension: 480,
  quality: 0.72,
  mimeType: 'image/jpeg',
} satisfies Required<Omit<ResizeOptions, 'maxBytes'>>;
"""),
("""function isJpegFile(source: File | Blob): boolean {
  const type = source.type.toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg') return true;
  return source instanceof File && /\\.(jpe?g)$/i.test(source.name);
}

""", ""),
(""" * 브라우저가 특정 JPEG를 디코딩하지 못하더라도 2MB 이하라면 원본을 그대로 반환한다.
 * 이 경우 업로드 계층이 원본을 저장하고 Service Worker/CDN 최적화를 맡을 수 있다.
""", """ * 디코딩에 실패하면 원본을 그대로 저장하지 않고 업로드를 중단한다.
 * 업로드 계층에서는 maxBytes를 지정해 Storage에 들어가는 이미지 크기도 제한한다.
"""),
("""  let drawableResult: Awaited<ReturnType<typeof loadDrawable>>;
  try {
    drawableResult = await loadDrawable(source);
  } catch (error) {
    const message = errorDescription(error);
    if (message.startsWith('[IMAGE_DECODE_ERROR]') && isJpegFile(source) && source.size <= MAX_ORIGINAL_FALLBACK_BYTES) {
      console.warn('브라우저 JPEG 디코딩 실패 — 2MB 이하 원본으로 업로드를 계속합니다.', sourceDescription(source));
      return source;
    }
    throw error;
  }
""", """  let drawableResult: Awaited<ReturnType<typeof loadDrawable>>;
  drawableResult = await loadDrawable(source);
"""),
("""    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
    if (!blob) throw new Error(`[IMAGE_ENCODE_ERROR] ${sourceDescription(source)} | mime=${mimeType} quality=${quality}`);
    return blob;
""", """    const encode = (targetCanvas: HTMLCanvasElement, targetQuality: number) =>
      new Promise<Blob | null>((resolve) => targetCanvas.toBlob(resolve, mimeType, targetQuality));

    let currentCanvas = canvas;
    let currentQuality = Math.min(1, Math.max(0.2, quality));
    let blob = await encode(currentCanvas, currentQuality);
    if (!blob) throw new Error(`[IMAGE_ENCODE_ERROR] ${sourceDescription(source)} | mime=${mimeType} quality=${currentQuality}`);

    if (options.maxBytes && blob.size > options.maxBytes) {
      for (let attempt = 0; attempt < 8 && blob.size > options.maxBytes; attempt += 1) {
        currentQuality = Math.max(0.2, currentQuality - 0.1);
        blob = await encode(currentCanvas, currentQuality);
        if (!blob) break;
      }
    }

    if (options.maxBytes && blob && blob.size > options.maxBytes) {
      let width = currentCanvas.width;
      let height = currentCanvas.height;
      for (let attempt = 0; attempt < 5 && blob.size > options.maxBytes; attempt += 1) {
        width = Math.max(1, Math.round(width * 0.85));
        height = Math.max(1, Math.round(height * 0.85));
        const smallerCanvas = document.createElement('canvas');
        smallerCanvas.width = width;
        smallerCanvas.height = height;
        const smallerCtx = smallerCanvas.getContext('2d');
        if (!smallerCtx) break;
        smallerCtx.imageSmoothingEnabled = true;
        smallerCtx.imageSmoothingQuality = 'high';
        smallerCtx.drawImage(drawable, 0, 0, width, height);
        currentCanvas = smallerCanvas;
        blob = await encode(currentCanvas, currentQuality);
        if (!blob) break;
      }
    }

    if (!blob) throw new Error(`[IMAGE_ENCODE_ERROR] ${sourceDescription(source)} | mime=${mimeType}`);
    if (options.maxBytes && blob.size > options.maxBytes) {
      throw new Error(`[IMAGE_SIZE_LIMIT_ERROR] ${sourceDescription(source)} | output=${blob.size} max=${options.maxBytes}`);
    }
    return blob;
""")
])

edit('src/components/feature/ClubBannerManager.tsx', [
("import ImageCropModal from '@/components/feature/ImageCropModal';", "import ImageCropModal from '@/components/feature/ImageCropModal';\nimport { resizeImageFile } from '@/lib/imageResize';"),
("const { error: uploadErr } = await supabase.storage.from('Public').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });", "const optimizedBlob = await resizeImageFile(blob, { maxDimension: type === 'hero' ? 1280 : 800, quality: 0.76, mimeType: 'image/jpeg', maxBytes: type === 'hero' ? 350 * 1024 : 220 * 1024 });\n      const { error: uploadErr } = await supabase.storage.from('Public').upload(path, optimizedBlob, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });")
])

edit('src/components/feature/SiteBanner.tsx', [
("import ImageCropModal from '@/components/feature/ImageCropModal';", "import ImageCropModal from '@/components/feature/ImageCropModal';\nimport { resizeImageFile } from '@/lib/imageResize';"),
("const { error: uploadErr } = await supabase.storage.from('Public').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });", "const optimizedBlob = await resizeImageFile(blob, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 });\n      const { error: uploadErr } = await supabase.storage.from('Public').upload(path, optimizedBlob, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });")
])

edit('src/pages/profile/page.tsx', [
("import { supabase } from '@/lib/supabase';", "import { supabase } from '@/lib/supabase';\nimport { resizeImageFile } from '@/lib/imageResize';"),
("""      const ext = file.name.split('.').pop();
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('Public').upload(path, file, { upsert: true });
""", """      const optimizedFile = await resizeImageFile(file, { maxDimension: 512, quality: 0.74, mimeType: 'image/jpeg', maxBytes: 120 * 1024 });
      const path = `avatars/${user.id}-${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from('Public').upload(path, optimizedFile, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
""")
])

edit('src/pages/clubs/community/page.tsx', [
("import { supabase } from '@/lib/supabase';", "import { supabase } from '@/lib/supabase';\nimport { resizeImageFile } from '@/lib/imageResize';"),
("""      let imageUrls: string[] = [];

      // Upload images first
      if (postImages.length > 0) {
        setUploadingImages(true);
        for (const file of postImages) {
          const ext = file.name.split('.').pop();
          const path = `club-posts/${clubId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from('Public').upload(path, file, { upsert: true });
          if (uploadErr) throw uploadErr;
          const { data: urlData } = supabase.storage.from('Public').getPublicUrl(path);
          imageUrls.push(urlData.publicUrl);
        }
        setUploadingImages(false);
      }
""", """      let imageUrls: string[] = [];
      const uploadedPaths: string[] = [];

      // Upload bounded-size images first
      if (postImages.length > 0) {
        setUploadingImages(true);
        try {
          for (const file of postImages) {
            const optimizedFile = await resizeImageFile(file, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 });
            const path = `club-posts/${clubId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
            const { error: uploadErr } = await supabase.storage.from('Public').upload(path, optimizedFile, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
            if (uploadErr) throw uploadErr;
            uploadedPaths.push(path);
            const { data: urlData } = supabase.storage.from('Public').getPublicUrl(path);
            imageUrls.push(urlData.publicUrl);
          }
        } catch (uploadError) {
          if (uploadedPaths.length) await supabase.storage.from('Public').remove(uploadedPaths);
          throw uploadError;
        } finally {
          setUploadingImages(false);
        }
      }
"""),
("""      if (insertError) {
        console.error('[ClubCommunity] post insert failed:', insertError, payload);
        throw new Error(insertError.message || '게시글 등록에 실패했습니다.');
      }
""", """      if (insertError) {
        if (uploadedPaths.length) await supabase.storage.from('Public').remove(uploadedPaths);
        console.error('[ClubCommunity] post insert failed:', insertError, payload);
        throw new Error(insertError.message || '게시글 등록에 실패했습니다.');
      }
""")
])

edit('src/pages/faithStorybook/page.tsx', [
("import { supabase } from '@/lib/supabase';", "import { supabase } from '@/lib/supabase';\nimport { resizeImageFile } from '@/lib/imageResize';"),
("const ext = uploadFile.name.split('.').pop() || 'jpg';", "const ext = 'jpg';"),
("const ext = editUploadFile.name.split('.').pop() || 'jpg';", "const ext = 'jpg';"),
("supabase.storage.from('Public').upload(path, uploadFile, { upsert: true })", "supabase.storage.from('Public').upload(path, await resizeImageFile(uploadFile, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 }), { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' })"),
("supabase.storage.from('Public').upload(path, editUploadFile, { upsert: true })", "supabase.storage.from('Public').upload(path, await resizeImageFile(editUploadFile, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 }), { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' })")
])

for path in ['src/pages/ganghakNews/write/page.tsx', 'src/pages/ganghakNews/edit/page.tsx']:
    edit(path, [
        ("import { supabase } from '@/lib/supabase';", "import { supabase } from '@/lib/supabase';\nimport { resizeImageFile } from '@/lib/imageResize';"),
        ("const ext = file.name.split('.').pop();", "const ext = 'jpg';"),
        ("supabase.storage.from('Public').upload(path, file, { upsert: true })", "supabase.storage.from('Public').upload(path, await resizeImageFile(file, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 }), { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' })")
    ])

edit('src/pages/missions/board/page.tsx', [
("import { supabase } from '@/lib/supabase';", "import { supabase } from '@/lib/supabase';\nimport { resizeImageFile } from '@/lib/imageResize';"),
("const fileExt = proofFile.name.split('.').pop() || 'jpg'; const filePath = `missions/proof/${proofAssignmentId}_${Date.now()}.${fileExt}`; uploadedFilePath = filePath; const { error: uploadErr } = await supabase.storage.from('Public').upload(filePath, proofFile, { cacheControl: '3600', upsert: false });", "const filePath = `missions/proof/${proofAssignmentId}_${Date.now()}.jpg`; uploadedFilePath = filePath; const optimizedProof = await resizeImageFile(proofFile, { maxDimension: 960, quality: 0.74, mimeType: 'image/jpeg', maxBytes: 300 * 1024 }); const { error: uploadErr } = await supabase.storage.from('Public').upload(filePath, optimizedProof, { cacheControl: '31536000', contentType: 'image/jpeg', upsert: false });")
])

edit('src/pages/memoryBoard/page.tsx', [
("resizeImageFile(uploadFile, { maxDimension: 1280, quality: 0.78, mimeType: 'image/jpeg' })", "resizeImageFile(uploadFile, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 })"),
("resizeImageFile(uploadFile, { maxDimension: 480, quality: 0.68, mimeType: 'image/jpeg' })", "resizeImageFile(uploadFile, { maxDimension: 480, quality: 0.68, mimeType: 'image/jpeg', maxBytes: 90 * 1024 })")
])

edit('src/pages/clubs/detail/page.tsx', [
("resizeImageFile(file, { maxDimension: 1280, quality: 0.78, mimeType: 'image/jpeg' })", "resizeImageFile(file, { maxDimension: 1280, quality: 0.76, mimeType: 'image/jpeg', maxBytes: 350 * 1024 })"),
("resizeImageFile(file, { maxDimension: 480, quality: 0.68, mimeType: 'image/jpeg' })", "resizeImageFile(file, { maxDimension: 480, quality: 0.68, mimeType: 'image/jpeg', maxBytes: 90 * 1024 })")
])

Path('supabase/migrations/20260905220000_harden_public_image_bucket.sql').write_text("""-- Public 버킷은 웹에서 표시하는 이미지 전용으로 제한한다.\n-- 모든 업로드 코드는 클라이언트에서 JPEG로 리사이즈/압축한 뒤 저장한다.\nupdate storage.buckets\nset\n  file_size_limit = 524288,\n  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]\nwhere id = 'Public';\n""")
