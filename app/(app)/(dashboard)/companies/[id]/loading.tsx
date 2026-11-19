import { LoadingScreen } from "@/components/loading-screen";

export default function Loading() {
  return (
    <LoadingScreen
      title={
        <>
          On ouvre <em>la fiche</em>
        </>
      }
      messages={["Lecture de l’entreprise…", "Recherche de ses dirigeants…", "Presque prêt…"]}
    />
  );
}
