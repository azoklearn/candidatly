import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { signUp } from "../actions";
import { CredentialsForm } from "../credentials-form";
import { GoogleButton, OrSeparator } from "../google-button";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Créez votre espace</CardTitle>
        <CardDescription>
          Ensuite, quelques questions rapides et vos offres s’affichent.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <GoogleButton next="/onboarding/1" />
        <OrSeparator />
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
