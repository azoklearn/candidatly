import { signOut } from "@/app/(auth)/actions";
import { BrandLink } from "@/components/brand-link";
import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";

export function AppHeader({ firstName }: { firstName: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <BrandLink href="/offers" />
        <NavLinks />
        <div className="ml-auto flex items-center gap-2 text-sm">
          {firstName ? (
            <span className="hidden items-center gap-2 text-muted-foreground sm:inline-flex">
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-foreground"
              >
                {firstName.slice(0, 1).toUpperCase()}
              </span>
              {firstName}
            </span>
          ) : null}
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Se déconnecter
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
