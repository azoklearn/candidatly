import { LoadingScreen } from "@/components/loading-screen";

export default function SearchResultLoading() {
  return (
    <LoadingScreen
      title={
        <>
          On rassemble <em>tes offres</em>
        </>
      }
      messages={[
        "On rassemble les offres trouvées…",
        "On regarde qui recrute près de chez toi…",
        "On vérifie la fraîcheur de ta sélection…",
      ]}
    />
  );
}
