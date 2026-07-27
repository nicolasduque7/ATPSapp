import { requireCoachId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ClassType, StudentLevel } from "@/lib/mock-data";

// Notifications are role-agnostic by design (recipient_id is just
// auth.users.id, RLS already scopes to "your own inbox" regardless of
// role) — one shared query works for both the coach and student sidebars,
// unlike most of this app's query layer which forks per role.
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) {
    console.error("getUnreadNotificationCount failed:", error);
    return 0;
  }

  return count ?? 0;
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
  if (error) console.error("markNotificationsRead failed:", error);
}

export interface PendingJoinRequestSummary {
  id: string;
  requestingStudentName: string;
  classStartTime: Date;
  classEndTime: Date;
}

// The pending-requests list is a LIVE query against class_join_requests, not
// a read of `notifications` rows — status can change after a notification
// was written, and the list should always reflect current truth.
// class_join_requests' own RLS (class_join_requests_select_as_coach) already
// scopes rows to classes this coach coaches; requireCoachId() here is
// defense-in-depth, matching this app's established query-layer convention.
export async function getPendingJoinRequestsForCoach(): Promise<PendingJoinRequestSummary[]> {
  await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_join_requests")
    .select(
      `
      id,
      created_at,
      requester:students!class_join_requests_requesting_student_id_fkey ( name ),
      class:classes!class_join_requests_class_id_fkey ( start_time, end_time )
      `
    )
    .eq("status", "pending")
    .order("created_at");

  if (error) {
    console.error("getPendingJoinRequestsForCoach failed:", error);
    throw new Error("Couldn't load join requests. Try again.");
  }

  return (data ?? []).flatMap((row) => {
    const requester = Array.isArray(row.requester) ? row.requester[0] : row.requester;
    const cls = Array.isArray(row.class) ? row.class[0] : row.class;
    if (!requester || !cls) return [];
    return [
      {
        id: row.id,
        requestingStudentName: requester.name,
        classStartTime: new Date(cls.start_time),
        classEndTime: new Date(cls.end_time),
      },
    ];
  });
}

export interface JoinRequestDetail {
  id: string;
  status: "pending" | "approved" | "rejected";
  requestingStudentName: string;
  requestingStudentLevel: StudentLevel;
  hostStudentName: string;
  hostStudentLevel: StudentLevel;
  locationName: string;
  classType: ClassType;
  startTime: Date;
  endTime: Date;
}
