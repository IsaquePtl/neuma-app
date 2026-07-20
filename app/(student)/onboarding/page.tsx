import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bem-vindo a Neuma
        </h1>
        <p className="text-sm text-muted-foreground">
          Antes de comecarmos, preciso de te conhecer melhor.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Diagnostico inicial</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Em breve: questionario de diagnostico e agendamento da call inicial.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
