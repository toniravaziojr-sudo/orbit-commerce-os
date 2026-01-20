import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  ArrowLeft, 
  Plus, 
  Edit2, 
  Trash2, 
  MoreVertical,
  GripVertical,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Mail,
  User,
  Phone,
  Type,
  CheckSquare,
  Circle,
} from "lucide-react";
import { useQuizzes, Quiz, QuizQuestion } from "@/hooks/useQuizzes";
import { QuizDialog } from "./QuizDialog";
import { QuestionDialog } from "./QuestionDialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const questionTypeIcons: Record<string, any> = {
  single_choice: Circle,
  multiple_choice: CheckSquare,
  text: Type,
  email: Mail,
  phone: Phone,
  name: User,
};

const questionTypeLabels: Record<string, string> = {
  single_choice: 'Escolha Única',
  multiple_choice: 'Múltipla Escolha',
  text: 'Texto Livre',
  email: 'Email',
  phone: 'Telefone',
  name: 'Nome',
};

export function QuizEditor() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { getQuiz, updateQuiz, deleteQuiz, togglePublish, deleteQuestion } = useQuizzes();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);

  const { data: quiz, isLoading, refetch } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => getQuiz(quizId!),
    enabled: !!quizId,
  });

  const handleEditQuestion = (question: QuizQuestion) => {
    setEditingQuestion(question);
    setQuestionDialogOpen(true);
  };

  const handleAddQuestion = () => {
    setEditingQuestion(undefined);
    setQuestionDialogOpen(true);
  };

  const handleDeleteQuestion = async () => {
    if (!deleteQuestionId) return;
    await deleteQuestion.mutateAsync(deleteQuestionId);
    setDeleteQuestionId(null);
    refetch();
  };

  const handleTogglePublish = async () => {
    if (!quiz) return;
    await togglePublish.mutateAsync({ 
      quizId: quiz.id, 
      publish: quiz.status !== 'published' 
    });
    refetch();
  };

  const handleDeleteQuiz = async () => {
    if (!quiz) return;
    await deleteQuiz.mutateAsync(quiz.id);
    navigate("/quizzes");
  };

  const copyQuizUrl = () => {
    if (!quiz) return;
    const url = `${window.location.origin}/quiz/${quiz.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("URL copiada!");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Quiz não encontrado</p>
        <Button variant="link" onClick={() => navigate("/quizzes")}>
          Voltar para lista
        </Button>
      </div>
    );
  }

  const questions = quiz.quiz_questions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate("/quizzes")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{quiz.name}</h1>
            <Badge variant={quiz.status === 'published' ? 'default' : 'secondary'}>
              {quiz.status === 'published' ? 'Publicado' : 'Rascunho'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            /{quiz.slug} • {questions.length} perguntas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyQuizUrl}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar URL
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleTogglePublish}
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
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Editar Configurações
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => window.open(`/quiz/${quiz.slug}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Visualizar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Quiz
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quiz Info */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Introdução</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {quiz.intro_text || "Nenhum texto de introdução definido"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conclusão</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {quiz.outro_text || "Obrigado por completar o quiz!"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Questions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Perguntas</CardTitle>
            <CardDescription>
              Arraste para reordenar as perguntas
            </CardDescription>
          </div>
          <Button onClick={handleAddQuestion}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Pergunta
          </Button>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground mb-4">
                Nenhuma pergunta adicionada ainda
              </p>
              <Button variant="outline" onClick={handleAddQuestion}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira pergunta
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((question, index) => {
                const Icon = questionTypeIcons[question.type] || Type;
                
                return (
                  <div
                    key={question.id}
                    className="flex items-start gap-3 p-4 border rounded-lg group hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GripVertical className="h-4 w-4 cursor-grab" />
                      <span className="text-sm font-medium w-6">
                        {index + 1}.
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {questionTypeLabels[question.type]}
                        </span>
                        {question.is_required && (
                          <Badge variant="outline" className="text-xs">
                            Obrigatória
                          </Badge>
                        )}
                      </div>
                      
                      <p className="font-medium">{question.question}</p>
                      
                      {question.options && question.options.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {question.options.map((opt: any, idx: number) => (
                            <span 
                              key={idx}
                              className="text-xs px-2 py-0.5 bg-muted rounded"
                            >
                              {opt.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditQuestion(question)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteQuestionId(question.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <QuizDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        quiz={quiz}
        onSuccess={() => refetch()}
      />

      <QuestionDialog
        open={questionDialogOpen}
        onOpenChange={setQuestionDialogOpen}
        quizId={quiz.id}
        question={editingQuestion}
        onSuccess={() => refetch()}
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
              onClick={handleDeleteQuiz}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog 
        open={!!deleteQuestionId} 
        onOpenChange={(open) => !open && setDeleteQuestionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pergunta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta pergunta?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuestion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
