import { LoadingScreen } from "@/components/loading-screen";

export default function ApplicationLoading() {
  return (
    <LoadingScreen
      title={
        <>
          On ouvre votre <em>lettre</em>
        </>
      }
      messages={["On récupère votre lettre…", "On prépare la comparaison…", "On vérifie le suivi…"]}
    />
  );
}
