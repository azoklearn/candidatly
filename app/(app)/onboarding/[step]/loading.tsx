import { LoadingScreen } from "@/components/loading-screen";

export default function OnboardingStepLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <LoadingScreen
        title={
          <>
            Un instant, <em>on avance</em>
          </>
        }
        messages={["On enregistre vos réponses…", "On prépare la suite…", "Presque fini…"]}
      />
    </main>
  );
}
