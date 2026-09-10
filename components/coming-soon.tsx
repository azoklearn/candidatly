import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Bientôt disponible</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
