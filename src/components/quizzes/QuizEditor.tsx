import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft, Plus, Edit2, Trash2, MoreVertical,
  GripVertical, Eye, EyeOff, Copy, ExternalLink,
  Mail, User, Phone, Type, CheckSquare, Circle,
  Image, Video, FileText, HelpCircle,
} from "lucide-react";
import { useQuizzes, Quiz, QuizQuestion } from "@/hooks/useQuizzes";
import { QuizDialog } from "./QuizDialog";
import { QuestionDialog } from "./QuestionDialog";
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

function StepBadge({ step }: { step: QuizQuestion }) {
  if (step.step_type === 'content') {
    return (
      <Badge variant="outline" className="text-xs bg-accent text-accent-foreground border-accent">
        <FileText className="h-3 w-3 mr-1" />
        Conteúdo
      </Badge>
    );
  }
  const Icon = questionTypeIcons[step.type] || Type;
  return (
    <Badge variant="outline" className="text-xs">
      <Icon className="h-3 w-3 mr-1" />
      {questionTypeLabels[step.type]}
    </Badge>
  );
}

function MediaPreview({ media }: { media?: { type: string; url: string; alt?: string } }) {
  if (!media) return null;
  
  if (media.type === 'image') {
    return (
      <div className="mt-2 w-20 h-14 rounded border overflow-hidden bg-muted/30">
        <img src={media.url} alt={media.alt || ''} className="w-full h-full object-cover" />
      </div>
    );
  }
  
  if (media.type === 'video') {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Video className="h-3.5 w-3.5" />
        <span className="truncate max-w-[200px]">{media.url}</span>
      </div>
    );
  }
  
  return null;
}

export function QuizEditor() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { getQuiz, deleteQuiz, togglePublish, deleteQuestion } = useQuizzes();
  
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
  const questionSteps = questions.filter(q => q.step_type !== 'content');
  const contentSteps = questions.filter(q => q.step_type === 'content');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/quizzes")}>
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
            /{quiz.slug} • {questions.length} etapas ({questionSteps.length} perguntas, {contentSteps.length} conteúdo)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyQuizUrl}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar URL
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleTogglePublish}>
            {quiz.status === 'published' ? (
              <><EyeOff className="h-4 w-4 mr-2" />Despublicar</>
            ) : (
              <><Eye className="h-4 w-4 mr-2" />Publicar</>
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
                <Edit2 className="h-4 w-4 mr-2" />Editar Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(`/quiz/${quiz.slug}`, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />Visualizar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />Excluir Quiz
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quiz Info */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Introdução</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {quiz.intro_text || "Nenhum texto de introdução definido"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Conclusão</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {quiz.outro_text || "Obrigado por completar o quiz!"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Steps */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Etapas do Quiz</CardTitle>
            <CardDescription>
              Adicione perguntas ou etapas de conteúdo (vídeos, imagens, textos)
            </CardDescription>
          </div>
          <Button onClick={handleAddQuestion}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Etapa
          </Button>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground mb-4">
                Nenhuma etapa adicionada ainda
              </p>
              <Button variant="outline" onClick={handleAddQuestion}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira etapa
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 p-4 border rounded-lg group hover:bg-muted/30 transition-colors ${
                    step.step_type === 'content' ? 'border-accent bg-accent/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GripVertical className="h-4 w-4 cursor-grab" />
                    <span className="text-sm font-medium w-6">{index + 1}.</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StepBadge step={step} />
                      {step.is_required && step.step_type === 'question' && (
                        <Badge variant="outline" className="text-xs">Obrigatória</Badge>
                      )}
                      {step.media && (
                        <Badge variant="outline" className="text-xs">
                          {step.media.type === 'image' ? <Image className="h-3 w-3 mr-1" /> : <Video className="h-3 w-3 mr-1" />}
                          {step.media.type === 'image' ? 'Imagem' : 'Vídeo'}
                        </Badge>
                      )}
                    </div>
                    
                    <p className="font-medium">{step.question}</p>
                    
                    {step.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{step.description}</p>
                    )}
                    
                    {step.options && step.options.length > 0 && step.step_type === 'question' && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {step.options.map((opt: any, idx: number) => (
                          <span key={idx} className="text-xs px-2 py-0.5 bg-muted rounded inline-flex items-center gap-1">
                            {opt.image_url && <Image className="h-3 w-3" />}
                            {opt.label}
                          </span>
                        ))}
                      </div>
                    )}

                    <MediaPreview media={step.media as any} />
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => handleEditQuestion(step)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteQuestionId(step.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <QuizDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} quiz={quiz} onSuccess={() => refetch()} />
      <QuestionDialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen} quizId={quiz.id} question={editingQuestion} onSuccess={() => refetch()} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Quiz</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Todas as etapas e respostas serão perdidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuiz} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteQuestionId} onOpenChange={(open) => !open && setDeleteQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Etapa</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta etapa?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuestion} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
