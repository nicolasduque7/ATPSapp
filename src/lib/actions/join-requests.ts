"use server";

import { revalidatePath } from "next/cache";

import { requireCoachId, requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { JoinRequestDetail } from "@/lib/queries/notifications";

// Wraps request_to_join_class (see the class_join_requests migration), which
// resolves the caller's student_id server-side and validates the class is
// open, not the caller's own, not already joined/pending, and has room —
// this action just surfaces the RPC's error message and revalidates the
// pages that show classes.
export async function requestToJoinClass(classId: string): Promise<void> {
  await requireStudent();
  const supabase = await createClient();

  const { error } = await supabase.rpc("request_to_join_class", { p_class_id: classId });

  if (error) {
    console.error("requestToJoinClass failed:", error);
    throw new Error(error.message || "Couldn't send the join request. Try again.");
  }

  revalidatePath("/student/calendar");
  revalidatePath("/student");
}

// Wraps decide_join_request, which re-validates capacity/conflicts, inserts
// the approved joiner, flips the class to 'Group', and writes the
// notification rows for both students — all atomically, inside the RPC. The
// RPC itself can't trigger Next.js revalidation, so that happens here.
export async function decideJoinRequest(requestId: string, approve: boolean): Promise<void> {
  await requireCoachId();
  const supabase = await createClient();

  const { error } = await supabase.rpc("decide_join_request", {
    p_request_id: requestId,
    p_approve: approve,
  });

  if (error) {
    console.error("decideJoinRequest failed:", error);
    throw new Error(error.message || "Couldn't record your decision. Try again.");
  }

  revalidatePath("/notifications");
  revalidatePath("/calendar");
  revalidatePath("/student/calendar");
  revalidatePath("/student/notifications");
}

// Lazily loaded by the decision dialog when a coach clicks a pending
// request — mirrors getClassSeriesMeta's "fetch full detail on demand from
// a client component" pattern, hence living here (a server action) rather
// than in lib/queries (server-component-only reads).
export async function getJoinRequestDetail(requestId: string): Promise<JoinRequestDetail> {
  await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_join_requests")
    .select(
      `
      id,
      status,
      requester:students!class_join_requests_requesting_student_id_fkey ( name, level ),
      class:classes!class_join_requests_class_id_fkey (
        start_time, end_time, class_type,
        location:locations ( name ),
        host:students!classes_student_id_fkey ( name, level )
      )
      `
    )
    .eq("id", requestId)
    .single();

  if (error) {
    console.error("getJoinRequestDetail failed:", error);
    throw new Error("Couldn't load the join request. Try again.");
  }

  const requester = Array.isArray(data.requester) ? data.requester[0] : data.requester;
  const cls = Array.isArray(data.class) ? data.class[0] : data.class;
  const location = Array.isArray(cls?.location) ? cls.location[0] : cls?.location;
  const host = Array.isArray(cls?.host) ? cls.host[0] : cls?.host;

  if (!requester || !cls || !location || !host) {
    throw new Error("This join request's class could not be found.");
  }

  return {
    id: data.id,
    status: data.status,
    requestingStudentName: requester.name,
    requestingStudentLevel: requester.level,
    hostStudentName: host.name,
    hostStudentLevel: host.level,
    locationName: location.name,
    classType: cls.class_type,
    startTime: new Date(cls.start_time),
    endTime: new Date(cls.end_time),
  };
}
