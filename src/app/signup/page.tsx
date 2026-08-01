import { getTranslations } from "next-intl/server";

import { SignupChooser } from "@/components/signup-chooser";
import { LanguageToggle } from "@/components/language-toggle";

export default async function SignupPage(): Promise<React.JSX.Element> {
  const t = await getTranslations("auth.signup");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="fixed top-4 right-4 z-40 rounded-full border border-black/5 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-white/10">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-sm rounded-3xl bg-card p-8">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <SignupChooser />
      </div>
    </div>
  );
}
