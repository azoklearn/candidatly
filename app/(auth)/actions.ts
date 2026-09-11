"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isGoogleSignInEnabled } from "@/lib/auth/providers";
import { authRedirectBase, DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/routes";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  message?: string;
  fieldErrors?: { email?: string; password?: string };
};

const NOT_CONFIGURED =
  "La connexion est indisponible : ce site n’est pas encore relié à sa base de données.";
const log = logger.child({ area: "auth" });

const CredentialsSchema = z.object({
  email: z.email({ error: "Saisissez une adresse email valide." }),
  password: z.string().min(8, { error: "Le mot de passe doit contenir au moins 8 caractères." }),
});

const SIGN_UP_ERRORS: Record<string, string> = {
  user_already_exists: "Un compte existe déjà avec cette adresse email.",
  weak_password: "Ce mot de passe est trop faible. Choisissez-en un plus long.",
  over_email_send_rate_limit: "Trop de tentatives. Réessayez dans quelques minutes.",
};

function readCredentials(formData: FormData) {
  return CredentialsSchema.safeParse({
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
}

function toFieldErrors(error: z.ZodError): NonNullable<AuthFormState["fieldErrors"]> {
  const fieldErrors: NonNullable<AuthFormState["fieldErrors"]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === "email" || field === "password") && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

export async function signIn(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = readCredentials(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    log.info("sign_in_failed", { code: error.code });
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Ce compte n’est pas encore activé. Réessayez dans quelques minutes."
          : "Email ou mot de passe incorrect.",
    };
  }
  redirect(safeNextPath(String(formData.get("next") ?? ""), DEFAULT_AFTER_LOGIN));
}

export async function signUp(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = readCredentials(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) {
    log.info("sign_up_failed", { code: error.code });
    const known = error.code ? SIGN_UP_ERRORS[error.code] : undefined;
    return { error: known ?? "L’inscription n’a pas abouti. Réessayez." };
  }
  // No email verification (docs/QUESTIONS.md C79). If the project still asks for one,
  // the new account is confirmed on the server and signed in straight away.
  if (!data.session) {
    const user = data.user;
    // An address already registered comes back as a user without identities: never touch it.
    if (!user || (user.identities?.length ?? 0) === 0) {
      return { error: SIGN_UP_ERRORS.user_already_exists };
    }
    if (!(await confirmNewAccount(user.id))) {
      return { error: "L’inscription n’a pas abouti. Réessayez." };
    }
    const signedIn = await supabase.auth.signInWithPassword(parsed.data);
    if (signedIn.error) {
      log.error("sign_up_sign_in_failed", { code: signedIn.error.code });
      return { error: "Votre compte est créé. Connectez-vous pour continuer." };
    }
  }
  redirect("/onboarding/1");
}

async function confirmNewAccount(userId: string): Promise<boolean> {
  try {
    const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (error) throw error;
    log.info("sign_up_auto_confirmed");
    return true;
  } catch (error) {
    log.error("sign_up_confirm_failed", { error });
    return false;
  }
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) redirect("/login?error=config");
  if (!(await isGoogleSignInEnabled())) redirect("/login?error=google_disabled");
  const next = safeNextPath(String(formData.get("next") ?? ""), DEFAULT_AFTER_LOGIN);
  const base = authRedirectBase(
    (await headers()).get("origin"),
    getPublicEnv().NEXT_PUBLIC_SITE_URL,
  );
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) {
    log.warn("google_sign_in_failed", { code: error?.code });
    redirect("/login?error=oauth");
  }
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
