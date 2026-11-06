import { signOut } from "@/app/(auth)/actions";
import { BrandLink } from "@/components/brand-link";
import { NavLinks } from "@/components/nav-links";

/** Header of the landing page, for the signed-in area: brand, swept links, the student. */
export function AppHeader({ firstName }: { firstName: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--pastel-line)] bg-[color-mix(in_srgb,var(--paper)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-4">
        <BrandLink href="/offers" />
        <NavLinks />
        <div className="ml-auto flex items-center gap-3 text-[0.8125rem]">
          {firstName ? (
            <span className="hidden items-center gap-2 text-muted-foreground sm:inline-flex">
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-[9px_9px_9px_2px] bg-brand-soft font-serif text-sm text-foreground"
              >
                {firstName.slice(0, 1).toUpperCase()}
              </span>
              {firstName}
            </span>
          ) : null}
          <form action={signOut}>
            <button type="submit" className="nav-sweep text-muted-foreground hover:text-foreground">
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
