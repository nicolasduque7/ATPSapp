import { getTranslations } from "next-intl/server";

import { CoachJoinRequestsList } from "@/components/notifications/coach-join-requests-list";
import { getPendingJoinRequestsForCoach, markAllNotificationsRead } from "@/lib/queries/notifications";

export default async function NotificationsPage(): Promise<React.JSX.Element> {
  const [requests, , t] = await Promise.all([
    getPendingJoinRequestsForCoach(),
    markAllNotificationsRead(),
    getTranslations("notifications"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <CoachJoinRequestsList requests={requests} />
    </div>
  );
}
