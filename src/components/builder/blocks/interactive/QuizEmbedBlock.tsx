// =============================================
// QUIZ EMBED BLOCK - Embeds a quiz from the Quizzes module
// Integrates with Email Marketing lists and tags
// =============================================

import React, { useState, useEffect } from 'react';
import { HelpCircle, Loader2, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface QuizQuestion {
  id: string;
  order_index: number;
  type: 'single_choice' | 'multiple_choice' | 'text' | 'email' | 'phone' | 'name';
  question: string;
  options?: { value: string; label: string; tags?: string[] }[];
  is_required: boolean;
  mapping?: { field?: string; tags?: string[] };
}

interface Quiz {
  id: string;
  name: string;
  intro_text?: string;
  outro_text?: string;
  list_id?: string;
  settings?: Record<string, any>;
  quiz_questions: QuizQuestion[];
}

export interface QuizEmbedBlockProps {
  quizId?: string;
  quizSlug?: string;
  
  // Visual
  backgroundColor?: string;
  textColor?: string;
  primaryColor?: string;
  borderRadius?: number;
  
  // Context
  tenantId?: string;
  isEditing?: boolean;
}

export function QuizEmbedBlock({
  quizId,
  quizSlug,
  backgroundColor,
  textColor,
  primaryColor,
  borderRadius = 12,
  tenantId,
  isEditing,
}: QuizEmbedBlockProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0); // 0 = intro, 1+ = questions, last = outro/success
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Load quiz data
  useEffect(() => {
    async function loadQuiz() {
      if (!quizId && !quizSlug) {
        setLoading(false);
        return;
      }

      try {
        let query = supabase
          .from('quizzes')
          .select('*, quiz_questions(*)')
          .eq('status', 'published');

        if (quizId) {
          query = query.eq('id', quizId);
        } else if (quizSlug && tenantId) {
          query = query.eq('slug', quizSlug).eq('tenant_id', tenantId);
        }

        const { data, error: fetchError } = await query.single();

        if (fetchError) throw fetchError;
        
        // Sort questions by order_index
        if (data?.quiz_questions) {
          (data.quiz_questions as any[]).sort((a: any, b: any) => a.order_index - b.order_index);
        }
        
        setQuiz(data as unknown as Quiz);
      } catch (err: any) {
        console.error('Error loading quiz:', err);
        setError('Quiz não encontrado');
      } finally {
        setLoading(false);
      }
    }

    loadQuiz();
  }, [quizId, quizSlug, tenantId]);

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    const questions = quiz?.quiz_questions || [];
    const totalSteps = questions.length + 2; // intro + questions + outro
    
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!quiz || isEditing) return;

    setSubmitting(true);

    try {
      const { data, error: submitError } = await supabase.functions.invoke('quiz-submit', {
        body: {
          tenant_id: tenantId,
          quiz_slug: quiz.id,
          answers,
          metadata: {
            submitted_at: new Date().toISOString(),
            user_agent: navigator.userAgent,
          },
        },
      });

      if (submitError) throw submitError;
      if (data && !data.success) throw new Error(data.error);

      setSubmitted(true);
      setCurrentStep((quiz.quiz_questions?.length || 0) + 1); // Go to outro
    } catch (err: any) {
      console.error('Quiz submit error:', err);
      setError('Erro ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    backgroundColor: backgroundColor || undefined,
    color: textColor || undefined,
    borderRadius: borderRadius ? `${borderRadius}px` : undefined,
  };

  // Configuration message in editing mode
  if (isEditing && !quizId && !quizSlug) {
    return (
      <div 
        className="py-12 px-4 bg-muted/30 border-2 border-dashed rounded-lg"
        style={containerStyle}
      >
        <div className="max-w-md mx-auto text-center">
          <HelpCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Quiz Embed</h3>
          <p className="text-muted-foreground text-sm">
            Selecione um quiz no painel lateral para exibi-lo aqui.
          </p>
          <p className="text-muted-foreground text-xs mt-2">
            Crie quizzes em Marketing → Quizzes
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-16 px-4 flex justify-center" style={containerStyle}>
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="py-12 px-4" style={containerStyle}>
        <div className="max-w-md mx-auto text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-4 text-destructive" />
          <p className="text-muted-foreground">{error || 'Quiz não encontrado'}</p>
        </div>
      </div>
    );
  }

  const questions = quiz.quiz_questions || [];
  const totalSteps = questions.length + 2; // intro + questions + outro
  const isIntro = currentStep === 0;
  const isOutro = currentStep === totalSteps - 1;
  const currentQuestion = !isIntro && !isOutro ? questions[currentStep - 1] : null;
  const progress = ((currentStep) / (totalSteps - 1)) * 100;

  // Render intro
  if (isIntro) {
    return (
      <div className="py-12 px-4" style={containerStyle}>
        <div className="max-w-lg mx-auto text-center">
          <HelpCircle className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-bold mb-4">{quiz.name}</h2>
          {quiz.intro_text && (
            <p className="text-muted-foreground mb-6">{quiz.intro_text}</p>
          )}
          <Button 
            onClick={handleNext} 
            size="lg"
            disabled={isEditing}
            style={primaryColor ? { backgroundColor: primaryColor } : undefined}
          >
            Começar
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // Render outro/success
  if (isOutro) {
    return (
      <div className="py-12 px-4" style={containerStyle}>
        <div className="max-w-lg mx-auto text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h2 className="text-2xl font-bold mb-4">
            {submitted ? 'Obrigado!' : quiz.name}
          </h2>
          <p className="text-muted-foreground">
            {quiz.outro_text || 'Suas respostas foram enviadas com sucesso!'}
          </p>
        </div>
      </div>
    );
  }

  // Render question
  if (!currentQuestion) return null;

  const currentAnswer = answers[currentQuestion.id];
  const canProceed = !currentQuestion.is_required || 
    (currentAnswer !== undefined && currentAnswer !== '' && 
      (Array.isArray(currentAnswer) ? currentAnswer.length > 0 : true));

  const isLastQuestion = currentStep === questions.length;

  return (
    <div className="py-8 px-4" style={containerStyle}>
      <div className="max-w-lg mx-auto">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Pergunta {currentStep} de {questions.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ 
                width: `${progress}%`,
                backgroundColor: primaryColor || undefined,
              }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-6">
            {currentQuestion.question}
            {currentQuestion.is_required && <span className="text-destructive ml-1">*</span>}
          </h3>

          {/* Single choice */}
          {currentQuestion.type === 'single_choice' && currentQuestion.options && (
            <RadioGroup
              value={currentAnswer || ''}
              onValueChange={(value) => handleAnswer(currentQuestion.id, value)}
              disabled={isEditing}
            >
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => (
                  <label
                    key={idx}
                    className={cn(
                      "flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors",
                      currentAnswer === option.value && "border-primary bg-primary/5"
                    )}
                  >
                    <RadioGroupItem value={option.value} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </RadioGroup>
          )}

          {/* Multiple choice */}
          {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => {
                const selected = Array.isArray(currentAnswer) && currentAnswer.includes(option.value);
                return (
                  <label
                    key={idx}
                    className={cn(
                      "flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors",
                      selected && "border-primary bg-primary/5"
                    )}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(checked) => {
                        const current = Array.isArray(currentAnswer) ? currentAnswer : [];
                        if (checked) {
                          handleAnswer(currentQuestion.id, [...current, option.value]);
                        } else {
                          handleAnswer(currentQuestion.id, current.filter(v => v !== option.value));
                        }
                      }}
                      disabled={isEditing}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Text inputs */}
          {(currentQuestion.type === 'text' || 
            currentQuestion.type === 'email' || 
            currentQuestion.type === 'phone' || 
            currentQuestion.type === 'name') && (
            <Input
              type={currentQuestion.type === 'email' ? 'email' : currentQuestion.type === 'phone' ? 'tel' : 'text'}
              value={currentAnswer || ''}
              onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
              placeholder={
                currentQuestion.type === 'email' ? 'seu@email.com' :
                currentQuestion.type === 'phone' ? '(00) 00000-0000' :
                currentQuestion.type === 'name' ? 'Seu nome' : 'Digite sua resposta'
              }
              className="text-lg py-6"
              disabled={isEditing}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handlePrev}
            disabled={isEditing}
          >
            Voltar
          </Button>
          
          {isLastQuestion ? (
            <Button 
              className="flex-1"
              onClick={handleSubmit}
              disabled={!canProceed || submitting || isEditing}
              style={primaryColor ? { backgroundColor: primaryColor } : undefined}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Enviar
            </Button>
          ) : (
            <Button 
              className="flex-1"
              onClick={handleNext}
              disabled={!canProceed || isEditing}
              style={primaryColor ? { backgroundColor: primaryColor } : undefined}
            >
              Próxima
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>

        {isEditing && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            [Modo de edição - interações desabilitadas]
          </p>
        )}
      </div>
    </div>
  );
}
