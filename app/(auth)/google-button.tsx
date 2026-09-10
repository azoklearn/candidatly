import { Button } from "@/components/ui/button";

import { signInWithGoogle } from "./actions";

export function GoogleButton({ next }: { next: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <Button type="submit" variant="outline" className="w-full">
        Continuer avec Google
      </Button>
    </form>
  );
}

export function OrSeparator() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      ou
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
