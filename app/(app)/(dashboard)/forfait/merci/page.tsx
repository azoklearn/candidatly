import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoadingScreen } from "@/components/loading-screen";
import { PaymentWatcher } from "@/components/payment-watcher";
import { requireUserId } from "@/lib/auth/session";
import { loadAccess } from "@/lib/billing/access";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Paiement" };

/** Return page of the Whop checkout: waits for the webhook, then opens the offers (C83). */
export default async function CheckoutReturnPage() {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const access = await loadAccess(supabase, userId);
  if (access.allowed) redirect("/offers");

  return (
    <div className="grid justify-items-center gap-2">
      <LoadingScreen
        title={
          <>
            On active votre <em>forfait</em>
          </>
        }
        messages={[
          "Whop nous confirme votre paiement…",
          "On ouvre vos offres…",
          "Encore un instant…",
        ]}
      />
      <PaymentWatcher />
    </div>
  );
}
