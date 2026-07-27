import { CoachJoinRequestsList } from "@/components/notifications/coach-join-requests-list";
import { getPendingJoinRequestsForCoach } from "@/lib/queries/notifications";

export default async function NotificationsPage(): Promise<React.JSX.Element> {
  const requests = await getPendingJoinRequestsForCoach();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">Requests from students waiting on your decision.</p>
      </div>

      <CoachJoinRequestsList requests={requests} />
    </div>
  );
}
