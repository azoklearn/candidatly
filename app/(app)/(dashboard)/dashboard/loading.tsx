import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="grid gap-12" aria-busy="true">
      <div className="grid gap-2">
        <p className="eyebrow">Votre espace</p>
        <h1 className="page-title">
          Votre <em>tableau de bord</em>
        </h1>
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="pulse-dot" aria-hidden />
          On rassemble vos chiffres…
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <li key={index} className="grid gap-2 rounded-3xl border bg-card p-5">
            <Skeleton className="h-9 w-12" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </li>
        ))}
      </ul>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <li key={index} className="grid gap-3 rounded-3xl border bg-card p-5">
            <Skeleton className="size-10 rounded-[14px]" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
