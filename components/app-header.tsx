import { signOut } from "@/app/(auth)/actions";
import { BrandLink } from "@/components/brand-link";
import { NavLinks } from "@/components/nav-links";

/** Header of the landing page, for the signed-in area: brand, swept links, the student. */
export function AppHeader({ firstName }: { firstName: string | null }) {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="glass-bar mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 !rounded-[1.75rem] px-5 py-3 sm:!rounded-full">
        <BrandLink href="/offers" />
        <NavLinks />
        <div className="ml-auto flex items-center gap-3 text-[0.8125rem]">
          {firstName ? (
            <span className="hidden items-center gap-2 text-muted-foreground sm:inline-flex">
              <span
                aria-hidden
                className="gem size-7 rounded-[10px] font-serif text-sm text-foreground"
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
