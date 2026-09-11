import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isGoogleSignInEnabled } from "@/lib/auth/providers";
import { isSupabaseConfigured } from "@/lib/env";

import { signUp } from "../actions";
import { CredentialsForm } from "../credentials-form";
import { GoogleButton, OrSeparator } from "../google-button";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignUpPage() {
  const configured = isSupabaseConfigured();
  const google = await isGoogleSignInEnabled();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Créez votre espace</CardTitle>
        <CardDescription>
          Ensuite, quelques questions rapides et vos offres s’affichent.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!configured ? (
          <Alert variant="destructive">
            <AlertDescription>
              La connexion est indisponible : ce site n’est pas encore relié à sa base de données.
            </AlertDescription>
          </Alert>
        ) : null}
        {google ? (
          <>
            <GoogleButton next="/onboarding/1" />
            <OrSeparator />
          </>
        ) : null}
        <CredentialsForm action={signUp} mode="sign-up" />
        <p className="text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
