import { Skeleton } from "@/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <div className="grid gap-8" aria-busy="true">
      <div className="grid gap-2">
        <p className="eyebrow">Réglages</p>
        <h1 className="page-title">
          Votre <em>compte</em>
        </h1>
        <Skeleton className="h-4 w-56" />
      </div>
      {[0, 1].map((index) => (
        <div key={index} className="grid max-w-2xl gap-4 border-t pt-8">
          <Skeleton className="h-6 w-32" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
