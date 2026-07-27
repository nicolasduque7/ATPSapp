import { requireCoachId, requireStudent } from "@/lib/auth";
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

// Called once when a notifications page renders, so the unread badge
// clears on next navigation rather than staying stuck forever (nothing
// else ever sets read_at). A plain client-scoped UPDATE is enough — RLS
// already restricts this to the caller's own rows.
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) console.error("markAllNotificationsRead failed:", error);
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

export type JoinRequestStatus = "pending" | "approved" | "rejected";

export interface SentJoinRequestSummary {
  requestId: string;
  status: JoinRequestStatus;
  hostStudentName: string;
  startTime: Date;
  endTime: Date;
}

interface SentJoinRequestRow {
  request_id: string;
  status: JoinRequestStatus;
  created_at: string;
  class_id: string;
  start_time: string;
  end_time: string;
  host_student_name: string;
}

// "Sent" direction: requests THIS student made to join someone else's Open
// Class, any status. Routed through a SECURITY DEFINER RPC for the same
// reason as get_open_classes_for_student — the host's name isn't otherwise
// readable via plain RLS.
export async function getSentJoinRequestsForStudent(): Promise<SentJoinRequestSummary[]> {
  await requireStudent();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_sent_join_requests_for_student");

  if (error) {
    console.error("getSentJoinRequestsForStudent failed:", error);
    throw new Error("Couldn't load your join requests. Try again.");
  }

  return ((data as SentJoinRequestRow[]) ?? []).map((row) => ({
    requestId: row.request_id,
    status: row.status,
    hostStudentName: row.host_student_name,
    startTime: new Date(row.start_time),
    endTime: new Date(row.end_time),
  }));
}

export interface ReceivedJoinSummary {
  classId: string;
  joiningStudentName: string;
  startTime: Date;
  endTime: Date;
}

interface ReceivedJoinRow {
  class_id: string;
  start_time: string;
  end_time: string;
  joining_student_name: string;
  joined_at: string;
}

// "Received" direction: students who joined a class THIS student hosts.
// Always "approved" (a row only exists once decide_join_request has run),
// per the product decision that a host is only ever told about decided
// requests, never raw pending ones.
export async function getReceivedJoinsForStudent(): Promise<ReceivedJoinSummary[]> {
  await requireStudent();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_received_joins_for_student");

  if (error) {
    console.error("getReceivedJoinsForStudent failed:", error);
    throw new Error("Couldn't load your classes' join activity. Try again.");
  }

  return ((data as ReceivedJoinRow[]) ?? []).map((row) => ({
    classId: row.class_id,
    joiningStudentName: row.joining_student_name,
    startTime: new Date(row.start_time),
    endTime: new Date(row.end_time),
  }));
}

export interface PartnerStudent {
  studentId: string;
  name: string;
  nickname: string | null;
  level: StudentLevel;
  racketType: string | null;
  forehandRating: number;
  backhandRating: number;
  backhandSliceRating: number;
  volleyRating: number;
  serveRating: number;
  dropShotRating: number;
}

interface PartnerStudentRow {
  student_id: string;
  name: string;
  nickname: string | null;
  level: StudentLevel;
  racket_type: string | null;
  forehand_rating: number;
  backhand_rating: number;
  backhand_slice_rating: number;
  volley_rating: number;
  serve_rating: number;
  drop_shot_rating: number;
}

function mapPartnerStudentRow(row: PartnerStudentRow): PartnerStudent {
  return {
    studentId: row.student_id,
    name: row.name,
    nickname: row.nickname,
    level: row.level,
    racketType: row.racket_type,
    forehandRating: row.forehand_rating,
    backhandRating: row.backhand_rating,
    backhandSliceRating: row.backhand_slice_rating,
    volleyRating: row.volley_rating,
    serveRating: row.serve_rating,
    dropShotRating: row.drop_shot_rating,
  };
}

// "Received" direction's detail dialog: every approved joiner of a class
// this student hosts (plural-ready, though v1 usually has 0 or 1).
export async function getClassPartnerStudents(classId: string): Promise<PartnerStudent[]> {
  await requireStudent();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_class_partner_students", { p_class_id: classId });

  if (error) {
    console.error("getClassPartnerStudents failed:", error);
    throw new Error("Couldn't load class details. Try again.");
  }

  return ((data as PartnerStudentRow[]) ?? []).map(mapPartnerStudentRow);
}
