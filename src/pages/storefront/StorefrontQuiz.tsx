import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface QuizQuestionOption {
  value: string;
  label: string;
  image_url?: string;
}

interface QuizQuestionMedia {
  type: 'image' | 'video';
  url: string;
  alt?: string;
}

interface QuizQuestion {
  id: string;
  order_index: number;
  step_type: string;
  type: string;
  question: string;
  description?: string;
  media?: QuizQuestionMedia;
  options: QuizQuestionOption[] | null;
  is_required: boolean;
  mapping: Record<string, any> | null;
}

interface Quiz {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  intro_text: string | null;
  outro_text: string | null;
  list_id: string | null;
  settings: Record<string, any> | null;
  quiz_questions: QuizQuestion[];
}

function extractVideoEmbed(url: string) {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

function StepMedia({ media }: { media?: QuizQuestionMedia }) {
  if (!media) return null;

  if (media.type === 'image') {
    return (
      <div className="rounded-lg overflow-hidden mb-4">
        <img src={media.url} alt={media.alt || ''} className="w-full max-h-80 object-contain" />
      </div>
    );
  }

  if (media.type === 'video') {
    const embedUrl = extractVideoEmbed(media.url);
    if (!embedUrl) return null;
    return (
      <div className="rounded-lg overflow-hidden mb-4 aspect-video">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allowFullScreen
          title="Video"
        />
      </div>
    );
  }

  return null;
}

function StepDescription({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="text-sm text-muted-foreground mb-4 prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

export default function StorefrontQuiz() {
  const { tenantSlug, quizSlug } = useParams<{ tenantSlug: string; quizSlug: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<"intro" | "questions" | "result">("intro");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuiz() {
      if (!tenantSlug || !quizSlug) return;

      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("slug", tenantSlug)
        .single();

      if (!tenant) { setLoading(false); return; }
      setTenantId(tenant.id);

      const { data: quizData, error } = await supabase
        .from("quizzes")
        .select("*, quiz_questions(*)")
        .eq("tenant_id", tenant.id)
        .eq("slug", quizSlug)
        .eq("status", "published")
        .single();

      if (error || !quizData) { setLoading(false); return; }

      const sortedQuestions = (quizData.quiz_questions || []).sort(
        (a: any, b: any) => a.order_index - b.order_index
      );

      setQuiz({ ...quizData, quiz_questions: sortedQuestions } as unknown as Quiz);
      setLoading(false);
    }
    loadQuiz();
  }, [tenantSlug, quizSlug]);

  const currentQuestion = quiz?.quiz_questions[currentQuestionIndex];
  const totalQuestions = quiz?.quiz_questions.length || 0;
  const progress = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0;
  const isContentStep = currentQuestion?.step_type === 'content';

  const handleAnswer = (value: any) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
  };

  const handleMultipleChoice = (option: string, checked: boolean) => {
    if (!currentQuestion) return;
    const current = answers[currentQuestion.id] || [];
    const updated = checked ? [...current, option] : current.filter((o: string) => o !== option);
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: updated }));
  };

  const canProceed = () => {
    if (!currentQuestion) return false;
    if (isContentStep) return true;
    if (!currentQuestion.is_required) return true;

    const answer = answers[currentQuestion.id];
    if (!answer) return false;
    if (currentQuestion.type === "multiple_choice") return Array.isArray(answer) && answer.length > 0;
    if (typeof answer === "string") return answer.trim().length > 0;
    return true;
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!quiz || !tenantId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("quiz-submit", {
        body: {
          tenant_id: tenantId,
          quiz_slug: quiz.slug,
          answers,
          metadata: { user_agent: navigator.userAgent, referrer: document.referrer },
        },
      });
      if (error) throw error;
      if (data?.success) {
        setResultMessage(data.message || quiz.outro_text || "Obrigado por completar o quiz!");
        setCurrentStep("result");
      } else {
        throw new Error(data?.error || "Erro ao enviar respostas");
      }
    } catch (error: any) {
      console.error("Quiz submit error:", error);
      toast.error("Erro ao enviar respostas. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasImageOptions = (options: QuizQuestionOption[] | null) => {
    return options?.some(o => o.image_url);
  };

  const renderQuestion = () => {
    if (!currentQuestion || isContentStep) return null;

    const options = currentQuestion.options || [];
    const useGridCards = hasImageOptions(options);

    switch (currentQuestion.type) {
      case "single_choice":
        if (useGridCards) {
          const selectedValue = answers[currentQuestion.id] || "";
          return (
            <div className="grid grid-cols-2 gap-3">
              {options.map((option, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAnswer(option.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center hover:shadow-md ${
                    selectedValue === option.value
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  {option.image_url && (
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted/30 mb-1">
                      <img src={option.image_url} alt={option.label} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          );
        }
        return (
          <RadioGroup
            value={answers[currentQuestion.id] || ""}
            onValueChange={handleAnswer}
            className="space-y-3"
          >
            {options.map((option, idx) => (
              <div key={idx} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value={option.value} id={`option-${idx}`} />
                <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "multiple_choice":
        if (useGridCards) {
          const selectedValues = answers[currentQuestion.id] || [];
          return (
            <div className="grid grid-cols-2 gap-3">
              {options.map((option, idx) => {
                const isChecked = selectedValues.includes(option.value);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleMultipleChoice(option.value, !isChecked)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center hover:shadow-md ${
                      isChecked
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    {option.image_url && (
                      <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted/30 mb-1">
                        <img src={option.image_url} alt={option.label} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
          );
        }
        return (
          <div className="space-y-3">
            {options.map((option, idx) => {
              const isChecked = (answers[currentQuestion.id] || []).includes(option.value);
              return (
                <div key={idx} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    id={`option-${idx}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleMultipleChoice(option.value, checked as boolean)}
                  />
                  <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              );
            })}
          </div>
        );

      case "text":
        return <Input value={answers[currentQuestion.id] || ""} onChange={(e) => handleAnswer(e.target.value)} placeholder="Digite sua resposta..." className="text-lg" />;
      case "email":
        return <Input type="email" value={answers[currentQuestion.id] || ""} onChange={(e) => handleAnswer(e.target.value)} placeholder="seu@email.com" className="text-lg" />;
      case "phone":
        return <Input type="tel" value={answers[currentQuestion.id] || ""} onChange={(e) => handleAnswer(e.target.value)} placeholder="(00) 00000-0000" className="text-lg" />;
      case "name":
        return <Input value={answers[currentQuestion.id] || ""} onChange={(e) => handleAnswer(e.target.value)} placeholder="Seu nome" className="text-lg" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Quiz não encontrado ou não publicado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-xl w-full">
        {currentStep === "intro" && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{quiz.name}</CardTitle>
              {quiz.intro_text && (
                <CardDescription className="text-base mt-2">{quiz.intro_text}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="text-center">
              <Button size="lg" onClick={() => setCurrentStep("questions")}>
                Começar Quiz
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </>
        )}

        {currentStep === "questions" && currentQuestion && (
          <>
            <CardHeader>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Etapa {currentQuestionIndex + 1} de {totalQuestions}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
              <CardTitle className="text-xl mt-4">{currentQuestion.question}</CardTitle>
              {!isContentStep && currentQuestion.is_required && (
                <span className="text-xs text-muted-foreground">* Obrigatório</span>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <StepDescription text={currentQuestion.description} />
              <StepMedia media={currentQuestion.media} />
              {renderQuestion()}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Anterior
                </Button>
                <Button onClick={handleNext} disabled={!canProceed() || submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : currentQuestionIndex === totalQuestions - 1 ? (
                    "Finalizar"
                  ) : (
                    <>
                      {isContentStep ? 'Continuar' : 'Próxima'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {currentStep === "result" && (
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Quiz Completo!</CardTitle>
            <p className="text-muted-foreground">{resultMessage}</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
