import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8" aria-busy="true">
      <div className="grid gap-2">
        <p className="eyebrow">Interne</p>
        <h1 className="page-title">
          Tableau de <em>bord</em>
        </h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
