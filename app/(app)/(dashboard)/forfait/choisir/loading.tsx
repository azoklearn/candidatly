import { LoadingScreen } from "@/components/loading-screen";

export default function ChoosePlanLoading() {
  return (
    <LoadingScreen
      title={
        <>
          On prépare <em>tes forfaits</em>
        </>
      }
      messages={[
        "On prépare tes forfaits…",
        "On regarde ce qui convient à ta recherche…",
        "On vérifie les prix du jour…",
      ]}
    />
  );
}
