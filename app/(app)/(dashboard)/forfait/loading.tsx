import { LoadingScreen } from "@/components/loading-screen";

export default function ChoosePlanLoading() {
  return (
    <LoadingScreen
      title={
        <>
          On fait le compte de <em>vos offres</em>
        </>
      }
      messages={[
        "On rassemble les offres trouvées…",
        "On regarde qui recrute près de chez vous…",
        "On prépare vos forfaits…",
      ]}
    />
  );
}
