import { InviteRedeemForm } from "@/components/invite-redeem-form";
import { createClient } from "@/lib/supabase/server";

interface InvitePreview {
  valid: boolean;
  reason: string;
  student_name: string;
  coach_name: string;
  email: string;
}

function inviteReasonMessage(reason: string | undefined): string {
  switch (reason) {
    case "redeemed":
      return "This invite has already been used.";
    case "expired":
      return "This invite has expired. Ask your coach to resend it.";
    default:
      return "This invite link isn't valid.";
  }
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.JSX.Element> {
  const { token } = await params;
  const supabase = await createClient();

  // A nonexistent token returns zero rows (not an error) since the RPC's
  // join can't match anything — `.single()` turns that into `error` being
  // set, which we treat the same as any other "not valid" outcome below.
  const { data, error } = await supabase.rpc("get_invite_preview", { p_token: token }).single<InvitePreview>();
  const preview = error ? null : data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-foreground">CourtSide</h1>
          {preview?.valid ? (
            <p className="text-sm text-muted-foreground">
              {preview.coach_name} invited you to join as {preview.student_name}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Join CourtSide</p>
          )}
        </div>

        {preview?.valid ? (
          <InviteRedeemForm token={token} email={preview.email} />
        ) : (
          <p className="text-sm text-destructive">{inviteReasonMessage(preview?.reason)}</p>
        )}
      </div>
    </div>
  );
}
