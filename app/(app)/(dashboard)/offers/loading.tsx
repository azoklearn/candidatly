import { LoadingMessages } from "@/components/loading-screen";
import { Skeleton } from "@/components/ui/skeleton";

function OfferCardSkeleton() {
  return (
    <li className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-5 w-3/4 max-w-md" />
          <Skeleton className="h-4 w-1/2 max-w-xs" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-36 rounded-full" />
      </div>
    </li>
  );
}

export default function OffersLoading() {
  return (
    <div className="grid gap-8" aria-busy="true">
      <div className="grid gap-2">
        <p className="eyebrow">Votre sélection</p>
        <h1 className="page-title">
          Vos <em>offres</em>
        </h1>
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="pulse-dot" aria-hidden />
          <LoadingMessages
            messages={[
              "On trie les offres selon votre profil…",
              "On calcule vos correspondances…",
              "On place les meilleures en haut…",
            ]}
          />
        </p>
      </div>
      <ul className="grid gap-3">
        {[0, 1, 2, 3].map((index) => (
          <OfferCardSkeleton key={index} />
        ))}
      </ul>
    </div>
  );
}
