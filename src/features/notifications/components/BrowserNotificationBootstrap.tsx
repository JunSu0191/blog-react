import { useEffect } from "react";
import {
  syncBrowserPushSubscription,
  ensureNotificationServiceWorker,
  getBrowserPushSupport,
} from "../push";

export default function BrowserNotificationBootstrap() {
  useEffect(() => {
    const support = getBrowserPushSupport();
    if (!support.supported) return;

    void ensureNotificationServiceWorker().catch(() => {
      // noop: 지원 브라우저라도 환경에 따라 등록 실패 가능
    });
    void syncBrowserPushSubscription().catch(() => {
      // noop: 백엔드 미구현 상태에서도 앱 부트스트랩은 계속 진행
    });
  }, []);

  return null;
}
