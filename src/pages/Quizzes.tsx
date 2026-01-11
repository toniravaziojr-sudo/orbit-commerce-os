import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { HelpCircle, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function Quizzes() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ["quizzes", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("quizzes")
        .select("*, quiz_questions(count), quiz_responses(count)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Quizzes"
        description="Crie quizzes interativos para capturar leads e engajar visitantes"
        actions={<Button><Plus className="h-4 w-4 mr-2" />Novo Quiz</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Seus Quizzes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : quizzes.length === 0 ? (
            <EmptyState
              icon={HelpCircle}
              title="Nenhum quiz criado"
              description="Crie seu primeiro quiz para capturar leads de forma interativa"
              action={<Button><Plus className="h-4 w-4 mr-2" />Criar Quiz</Button>}
            />
          ) : (
            <div className="space-y-3">
              {quizzes.map((quiz: any) => (
                <div key={quiz.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{quiz.name}</p>
                    <p className="text-sm text-muted-foreground">
                      /{quiz.slug} • {quiz.quiz_questions?.[0]?.count || 0} perguntas • {quiz.quiz_responses?.[0]?.count || 0} respostas
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${quiz.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {quiz.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
