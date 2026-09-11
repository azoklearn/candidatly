"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const EVERY_MS = 3_000;
const GIVE_UP_AFTER_MS = 90_000;

/**
 * Reloads the page data while Whop's confirmation is on its way: the server page sends
 * the student to their offers as soon as the membership is stored.
 */
export function PaymentWatcher() {
  const router = useRouter();
  const [late, setLate] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > GIVE_UP_AFTER_MS) {
        clearInterval(timer);
        setLate(true);
        return;
      }
      router.refresh();
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [router]);

  if (!late) return null;
  return (
    <p role="status" className="max-w-md text-center text-sm text-muted-foreground">
      La confirmation de Whop prend plus de temps que prévu. Si votre paiement est passé, votre
      forfait s’activera dans quelques minutes :{" "}
      <Link href="/offers" className="font-medium text-brand underline underline-offset-4">
        réessayer
      </Link>
      .
    </p>
  );
}
