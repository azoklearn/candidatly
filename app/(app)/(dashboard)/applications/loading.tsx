import { LoadingMessages } from "@/components/loading-screen";
import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicationsLoading() {
  return (
    <div className="grid gap-8" aria-busy="true">
      <div className="grid gap-2">
        <p className="eyebrow">Votre suivi</p>
        <h1 className="page-title">
          Vos <em>candidatures</em>
        </h1>
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="pulse-dot" aria-hidden />
          <LoadingMessages
            messages={[
              "On rassemble vos candidatures…",
              "On regarde les relances à faire…",
              "Presque prêt…",
            ]}
          />
        </p>
      </div>
      <ul className="grid gap-3">
        {[0, 1, 2].map((index) => (
          <li
            key={index}
            className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 sm:p-5"
          >
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-5 w-2/3 max-w-md" />
              <Skeleton className="h-4 w-1/3 max-w-xs" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
