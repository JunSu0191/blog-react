import { useState } from "react";
import { SegmentedControl, SurfaceCard } from "@/shared/ui";
import NotificationList from "../components/NotificationList";
import NotificationPushSettings from "../components/NotificationPushSettings";

type NotificationTab = "all" | "comment" | "chat" | "unread";

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<NotificationTab>("all");

  return (
    <div className="route-enter space-y-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">알림</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          댓글, 채팅, 읽지 않은 알림을 분리해서 확인할 수 있습니다.
        </p>
      </div>

      <SurfaceCard className="p-4 sm:p-6">
        <div className="space-y-4">
          <NotificationPushSettings />
          <SegmentedControl<NotificationTab>
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: "all", label: "전체" },
              { value: "comment", label: "댓글" },
              { value: "chat", label: "채팅" },
              { value: "unread", label: "읽지 않음" },
            ]}
            className="w-full sm:max-w-[420px]"
          />
          <NotificationList filter={activeTab} />
        </div>
      </SurfaceCard>
    </div>
  );
}
