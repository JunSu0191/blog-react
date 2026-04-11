import { useEffect, useMemo, useState } from "react";
import { BellRing, Smartphone, MonitorSmartphone } from "lucide-react";
import { Button } from "@/shared/ui";
import { useToast } from "@/shared/ui/ToastProvider";
import {
  getBrowserPushStatus,
  registerBrowserPush,
  unregisterBrowserPush,
  type BrowserPushPlatform,
} from "../push";

const PLATFORM_LABEL: Record<BrowserPushPlatform, string> = {
  desktop: "데스크톱 브라우저",
  android: "안드로이드 브라우저",
  ios_limited: "iOS 제한 지원",
  unsupported: "지원되지 않음",
};

function platformIcon(platform: BrowserPushPlatform) {
  if (platform === "desktop") return MonitorSmartphone;
  return Smartphone;
}

export default function NotificationPushSettings() {
  const { success, error, info } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [supported, setSupported] = useState(false);
  const [platform, setPlatform] = useState<BrowserPushPlatform>("unsupported");
  const [reason, setReason] = useState<string | undefined>();
  const [subscribed, setSubscribed] = useState(false);

  const refreshStatus = async () => {
    setIsLoading(true);
    try {
      const status = await getBrowserPushStatus();
      setPermission(status.permission);
      setSupported(status.support.supported);
      setPlatform(status.support.platform);
      setReason(status.support.reason);
      setSubscribed(status.subscribed);
    } catch (caughtError) {
      setPermission("unsupported");
      setSupported(false);
      setPlatform("unsupported");
      setReason(
        caughtError instanceof Error
          ? caughtError.message
          : "브라우저 알림 상태를 확인하지 못했습니다.",
      );
      setSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const statusLabel = useMemo(() => {
    if (!supported) return "이 브라우저에서는 웹 푸시를 사용할 수 없습니다.";
    if (subscribed) return "브라우저 백그라운드 알림이 켜져 있습니다.";
    if (permission === "denied") return "브라우저 알림 권한이 차단되어 있습니다.";
    return "브라우저 알림이 아직 꺼져 있습니다.";
  }, [permission, subscribed, supported]);

  const PlatformIcon = platformIcon(platform);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          <BellRing className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              브라우저 백그라운드 알림
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <PlatformIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {PLATFORM_LABEL[platform]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {statusLabel}
          </p>
          {reason ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {reason}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            댓글, 채팅, 친구 요청 알림을 브라우저가 백그라운드에 있어도 받을 수 있습니다.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void (async () => {
                  setIsSubmitting(true);
                  try {
                    const result = await registerBrowserPush();
                    await refreshStatus();
                    if (result.state === "subscribed") {
                      success("브라우저 백그라운드 알림을 켰습니다.");
                      return;
                    }
                    if (result.state === "permission_denied") {
                      info(result.reason || "브라우저 알림 권한이 필요합니다.");
                      return;
                    }
                    error(result.reason || "브라우저 알림 설정에 실패했습니다.");
                  } finally {
                    setIsSubmitting(false);
                  }
                })();
              }}
              disabled={!supported || isSubmitting || isLoading || subscribed}
              isLoading={isSubmitting && !subscribed}
              loadingText="설정 중..."
            >
              알림 켜기
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void (async () => {
                  setIsSubmitting(true);
                  try {
                    await unregisterBrowserPush();
                    await refreshStatus();
                    success("브라우저 백그라운드 알림을 껐습니다.");
                  } catch (caughtError) {
                    error(
                      caughtError instanceof Error
                        ? caughtError.message
                        : "브라우저 알림 해제에 실패했습니다.",
                    );
                  } finally {
                    setIsSubmitting(false);
                  }
                })();
              }}
              disabled={!supported || isSubmitting || isLoading || !subscribed}
            >
              알림 끄기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
