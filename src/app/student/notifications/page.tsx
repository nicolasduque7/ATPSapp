import { StudentNotificationsView } from "@/components/notifications/student-notifications-view";
import {
  getSentJoinRequestsForStudent,
  getReceivedJoinsForStudent,
  markAllNotificationsRead,
} from "@/lib/queries/notifications";

export default async function StudentNotificationsPage(): Promise<React.JSX.Element> {
  const [sentRequests, receivedJoins] = await Promise.all([
    getSentJoinRequestsForStudent(),
    getReceivedJoinsForStudent(),
    markAllNotificationsRead(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">Your Open Class join requests and activity.</p>
      </div>

      <StudentNotificationsView sentRequests={sentRequests} receivedJoins={receivedJoins} />
    </div>
  );
}
