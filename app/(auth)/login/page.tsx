import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isGoogleSignInEnabled } from "@/lib/auth/providers";
import { safeNextPath } from "@/lib/auth/routes";
import { isSupabaseConfigured } from "@/lib/env";

import { signIn } from "../actions";
import { CredentialsForm } from "../credentials-form";
import { GoogleButton, OrSeparator } from "../google-button";
import { firstParam, type SearchParams } from "../search-params";

export const metadata: Metadata = { title: "Connexion" };

const ERROR_MESSAGES: Record<string, string> = {
  callback:
    "La connexion n’a pas abouti. Si vous venez de confirmer votre adresse email, connectez-vous avec votre email et votre mot de passe.",
  confirm: "Le lien de confirmation est invalide ou a expiré.",
  oauth:
    "La connexion avec Google n’a pas abouti. Utilisez votre adresse email ou réessayez plus tard.",
  google_disabled:
    "La connexion avec Google n’est pas encore disponible. Utilisez votre adresse email.",
  config: "La connexion est indisponible : ce site n’est pas encore relié à sa base de données.",
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(firstParam(params.next));
  const errorCode = firstParam(params.error);
  const configured = isSupabaseConfigured();
  const google = await isGoogleSignInEnabled();
  const errorMessage = !configured
    ? ERROR_MESSAGES.config
    : errorCode
      ? ERROR_MESSAGES[errorCode]
      : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Retrouvez vos offres et vos candidatures.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {google ? (
          <>
            <GoogleButton next={next} />
            <OrSeparator />
          </>
        ) : null}
        <CredentialsForm action={signIn} mode="sign-in" next={next} />
        <p className="text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
            Créer un compte
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
