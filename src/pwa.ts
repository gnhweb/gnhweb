import { registerSW } from 'virtual:pwa-register';

// 이 파일이 하는 일 한 가지:
// "지금 이 기기가 최신 배포판을 보고 있는가?"를 최대한 자주/빠르게 확인하고,
// 최신이 아니면 사용자에게 묻지 않고 바로 새로고침해서 항상 같은 화면(같은 CSS)을 보게 한다.
// 이전 방식(injectRegister: 'auto')은 새 버전을 백그라운드에서만 조용히 받아두고
// 화면은 그대로 두었기 때문에, 기기마다 마지막으로 새로고침한 시점의 CSS가 서로 다르게 남아있었다.

let refreshing = false;

// 새 서비스워커가 컨트롤을 넘겨받는 순간(= 업데이트 적용 시점) 페이지를 한 번만 새로고침
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (refreshing) return;
  refreshing = true;
  window.location.reload();
});

const updateSW = registerSW({
  immediate: true,

  onNeedRefresh() {
    // 새 버전이 감지되면 즉시 반영 (팝업/확인 없이 자동 적용)
    updateSW(true);
  },

  onOfflineReady() {
    // 오프라인 캐시 준비 완료 (별도 UI 노출 없음)
  },

  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    // 앱을 켜자마자 한 번, 그리고 브라우저 탭/PWA를 다시 활성화할 때마다
    // "지금 배포판이 최신인지" 서버에 재확인한다.
    registration.update().catch((error) => {
      console.warn('[PWA] 서비스워커 업데이트 확인 실패:', error);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch((error) => {
      console.warn('[PWA] 서비스워커 업데이트 확인 실패:', error);
    });
      }
    });

    window.addEventListener('focus', () => {
      registration.update().catch((error) => {
      console.warn('[PWA] 서비스워커 업데이트 확인 실패:', error);
    });
    });
  },

  onRegisterError(error) {
    console.error('[PWA] 서비스워커 등록 실패:', error);
  },
});
