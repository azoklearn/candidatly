import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/auth/routes";

import { signIn } from "../actions";
import { CredentialsForm } from "../credentials-form";
import { GoogleButton, OrSeparator } from "../google-button";
import { firstParam, type SearchParams } from "../search-params";

export const metadata: Metadata = { title: "Connexion" };

const ERROR_MESSAGES: Record<string, string> = {
  callback: "La connexion n’a pas abouti. Réessayez.",
  confirm: "Le lien de confirmation est invalide ou a expiré.",
  oauth: "La connexion avec Google n’a pas abouti.",
  config: "L’authentification n’est pas encore configurée sur cet environnement.",
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(firstParam(params.next));
  const errorCode = firstParam(params.error);
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] : undefined;

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
        <GoogleButton next={next} />
        <OrSeparator />
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
