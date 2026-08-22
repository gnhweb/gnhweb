/** Cross-platform mobile runtime helpers. */

function patchVibrateForUnsupportedBrowsers() {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent || '')) {
    try { Object.defineProperty(navigator, 'vibrate', { configurable:true, value:() => false }); } catch {}
  }
}

function observeScrollLock() {
  if (typeof document === 'undefined') return;
  let locked=false, savedScrollY=0;
  const sync=()=>{
    const nextLocked=document.body.classList.contains('scroll-lock');
    if(nextLocked&&!locked){locked=true;savedScrollY=window.scrollY;document.body.style.top=`-${savedScrollY}px`;document.body.dataset.scrollLockY=String(savedScrollY);return;}
    if(!nextLocked&&locked){locked=false;const restoreY=Number(document.body.dataset.scrollLockY||savedScrollY||0);document.body.style.top='';delete document.body.dataset.scrollLockY;requestAnimationFrame(()=>window.scrollTo({top:restoreY,behavior:'auto'}));}
  };
  const observer=new MutationObserver(sync); observer.observe(document.body,{attributes:true,attributeFilter:['class']}); sync();
}

function upgradeHiddenPinInputs() {
  if (typeof document === 'undefined') return;
  const upgrade=()=>document.querySelectorAll<HTMLInputElement>('input[data-gnh-pin-input]').forEach((input)=>{
    input.setAttribute('aria-label','PIN 입력');
    input.style.pointerEvents='auto'; input.style.position='fixed'; input.style.left='-10000px'; input.style.top='0'; input.style.width='1px'; input.style.height='1px'; input.style.opacity='0';
  });
  upgrade(); const observer=new MutationObserver(upgrade); observer.observe(document.body,{subtree:true,childList:true});
}

function enableLazyImages() {
  if (typeof document==='undefined' || typeof IntersectionObserver==='undefined') return;
  const seen=new WeakSet<HTMLImageElement>();
  const io=new IntersectionObserver((entries,observer)=>{
    entries.forEach((entry)=>{ if(!entry.isIntersecting) return; const img=entry.target as HTMLImageElement; img.decoding='async'; observer.unobserve(img); });
  },{rootMargin:'300px 0px'});
  const observeImages=(root:ParentNode)=>root.querySelectorAll<HTMLImageElement>('img').forEach((img)=>{if(seen.has(img))return;seen.add(img);img.decoding='async';if(img.getBoundingClientRect().top>window.innerHeight*1.25)img.loading='lazy';io.observe(img);});
  observeImages(document);
  const mo=new MutationObserver((records)=>records.forEach((record)=>record.addedNodes.forEach((node)=>{if(node instanceof Element) observeImages(node);}))); mo.observe(document.body,{subtree:true,childList:true});
}

function addExternalResourceHints() {
  if (typeof document==='undefined') return;
  ['https://readdy.ai','https://cdnjs.cloudflare.com','https://fonts.googleapis.com','https://fonts.gstatic.com'].forEach((href)=>{
    if(document.querySelector(`link[data-gnh-preconnect="${href}"]`))return;
    const p=document.createElement('link'); p.rel='preconnect'; p.href=href; p.crossOrigin='anonymous'; p.dataset.gnhPreconnect=href; document.head.appendChild(p);
    const d=document.createElement('link'); d.rel='dns-prefetch'; d.href=href; document.head.appendChild(d);
  });
}

export function initMobileRuntime(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  observeScrollLock(); upgradeHiddenPinInputs(); enableLazyImages(); addExternalResourceHints(); patchVibrateForUnsupportedBrowsers();
}
