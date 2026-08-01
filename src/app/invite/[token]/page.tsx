import { getTranslations } from "next-intl/server";

import { InviteRedeemForm } from "@/components/invite-redeem-form";
import { LanguageToggle } from "@/components/language-toggle";
import { createClient } from "@/lib/supabase/server";

interface InvitePreview {
  valid: boolean;
  reason: string;
  student_name: string;
  coach_name: string;
  email: string;
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.JSX.Element> {
  const { token } = await params;
  const supabase = await createClient();
  const t = await getTranslations("auth.invite");

  function inviteReasonMessage(reason: string | undefined): string {
    switch (reason) {
      case "redeemed":
        return t("reasonRedeemed");
      case "expired":
        return t("reasonExpired");
      default:
        return t("reasonInvalid");
    }
  }

  // A nonexistent token returns zero rows (not an error) since the RPC's
  // join can't match anything — `.single()` turns that into `error` being
  // set, which we treat the same as any other "not valid" outcome below.
  const { data, error } = await supabase.rpc("get_invite_preview", { p_token: token }).single<InvitePreview>();
  const preview = error ? null : data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="fixed top-4 right-4 z-40 rounded-full border border-black/5 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-white/10">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-sm rounded-3xl bg-card p-8">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-foreground">{t("title")}</h1>
          {preview?.valid ? (
            <p className="text-sm text-muted-foreground">
              {t("invitedAs", { coachName: preview.coach_name, studentName: preview.student_name })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("joinFallback")}</p>
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
