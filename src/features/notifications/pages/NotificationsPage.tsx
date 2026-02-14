import SurfaceCard from "@/shared/ui/SurfaceCard";
import NotificationList from "../components/NotificationList";

export default function NotificationsPage() {
  return (
    <div className="route-enter space-y-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">인앱 알림</h1>
        <p className="mt-1 text-sm text-slate-500">실시간으로 도착한 알림을 확인하고 읽음 처리합니다.</p>
      </div>

      <SurfaceCard>
        <NotificationList />
      </SurfaceCard>
    </div>
  );
}
