import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function PathPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: path } = await supabase
    .from("paths")
    .select("id, title, description")
    .eq("student_id", user!.id)
    .maybeSingle();

  const { data: activeNode } = await supabase
    .from("nodes")
    .select("id, title, description, order_index")
    .eq("path_id", path?.id ?? "")
    .eq("status", "active")
    .maybeSingle();

  if (!path) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>O teu percurso esta a ser preparado</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ainda nao tens um percurso atribuido. Apos a nossa call inicial,
            vais encontrar aqui o teu primeiro nivel.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{path.title}</h1>
        {path.description ? (
          <p className="text-sm text-muted-foreground">{path.description}</p>
        ) : null}
      </div>

      {activeNode ? (
        <Card>
          <CardHeader className="space-y-2">
            <Badge variant="secondary" className="w-fit">
              Nivel {activeNode.order_index + 1}
            </Badge>
            <CardTitle>{activeNode.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeNode.description ? (
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {activeNode.description}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sem nivel ativo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aguarda enquanto preparo o proximo passo do teu percurso.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
