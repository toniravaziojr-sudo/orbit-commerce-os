import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  HelpCircle, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Eye, 
  EyeOff,
  Copy,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuizzes, Quiz } from "@/hooks/useQuizzes";
import { QuizDialog } from "./QuizDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function QuizList() {
  const navigate = useNavigate();
  const { quizzes, isLoading, deleteQuiz, togglePublish } = useQuizzes();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);

  const handleCreate = () => {
    setEditingQuiz(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingQuizId) return;
    await deleteQuiz.mutateAsync(deletingQuizId);
    setDeletingQuizId(null);
    setDeleteDialogOpen(false);
  };

  const handleTogglePublish = async (quiz: Quiz) => {
    await togglePublish.mutateAsync({ 
      quizId: quiz.id, 
      publish: quiz.status !== 'published' 
    });
  };

  const copyQuizUrl = (quiz: Quiz) => {
    const url = `${window.location.origin}/quiz/${quiz.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("URL copiada!");
  };

  const onQuizCreated = (quiz: any) => {
    navigate(`/quizzes/${quiz.id}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Seus Quizzes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Seus Quizzes</CardTitle>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Quiz
          </Button>
        </CardHeader>
        <CardContent>
          {quizzes.length === 0 ? (
            <EmptyState
              icon={HelpCircle}
              title="Nenhum quiz criado"
              description="Crie seu primeiro quiz para capturar leads de forma interativa"
              action={{ label: "Criar Quiz", onClick: handleCreate }}
            />
          ) : (
            <div className="space-y-3">
              {quizzes.map((quiz: any) => {
                const questionCount = quiz.quiz_questions?.[0]?.count || 0;
                const responseCount = quiz.quiz_responses?.[0]?.count || 0;
                const listName = quiz.email_marketing_lists?.name;
                const tagName = quiz.customer_tags?.name;

                return (
                  <div 
                    key={quiz.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/quizzes/${quiz.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{quiz.name}</p>
                        <Badge 
                          variant={quiz.status === 'published' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {quiz.status === 'published' ? 'Publicado' : 'Rascunho'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>/{quiz.slug}</span>
                        <span>•</span>
                        <span>{questionCount} perguntas</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          {responseCount} respostas
                        </span>
                      </div>
                      {(listName || tagName) && (
                        <div className="flex items-center gap-2 mt-1">
                          {listName && (
                            <Badge variant="outline" className="text-xs">
                              Lista: {listName}
                            </Badge>
                          )}
                          {tagName && (
                            <Badge variant="outline" className="text-xs">
                              Tag: {tagName}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/quizzes/${quiz.id}`);
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePublish(quiz);
                          }}
                        >
                          {quiz.status === 'published' ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Despublicar
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Publicar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            copyQuizUrl(quiz);
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar URL
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/quiz/${quiz.slug}`, '_blank');
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingQuizId(quiz.id);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <QuizDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        quiz={editingQuiz}
        onSuccess={onQuizCreated}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Quiz</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este quiz? Esta ação não pode ser desfeita.
              Todas as perguntas e respostas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
