import { LoadingMessages } from "@/components/loading-screen";
import { Skeleton } from "@/components/ui/skeleton";

export default function OfferLoading() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <Skeleton className="h-4 w-32" />
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-6">
          <div className="grid gap-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <div className="grid content-start gap-4 rounded-2xl border bg-card p-5">
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="pulse-dot" aria-hidden />
            <LoadingMessages
              messages={[
                "On récupère l’offre…",
                "On regarde qui recrute…",
                "On vérifie la correspondance…",
              ]}
            />
          </p>
          <Skeleton className="h-11 rounded-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
