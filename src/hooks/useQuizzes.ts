import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface QuizQuestionOption {
  value: string;
  label: string;
  tags?: string[];
  image_url?: string;
  [key: string]: string | string[] | undefined;
}

export interface QuizQuestionMedia {
  type: 'image' | 'video';
  url: string;
  alt?: string;
  [key: string]: string | undefined;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  order_index: number;
  step_type: 'question' | 'content';
  type: 'single_choice' | 'multiple_choice' | 'text' | 'email' | 'phone' | 'name';
  question: string;
  description?: string;
  media?: QuizQuestionMedia;
  options?: QuizQuestionOption[];
  is_required: boolean;
  mapping?: { field?: string; tags?: string[] };
}

export interface Quiz {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  intro_text?: string;
  outro_text?: string;
  list_id?: string;
  tag_id?: string;
  tags_to_add?: string[];
  settings?: Record<string, any>;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
  quiz_questions?: QuizQuestion[];
  quiz_responses?: { count: number }[];
}

export interface QuizFormData {
  name: string;
  slug: string;
  intro_text?: string;
  outro_text?: string;
  list_id?: string;
  tag_id?: string;
  settings?: Record<string, any>;
}

export interface QuestionFormData {
  step_type: 'question' | 'content';
  type: QuizQuestion['type'];
  question: string;
  description?: string;
  media?: QuizQuestionMedia | null;
  options?: QuizQuestionOption[];
  is_required?: boolean;
  mapping?: { field?: string; tags?: string[] };
}

export function useQuizzes() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // List all quizzes
  const { data: quizzes = [], isLoading, refetch } = useQuery({
    queryKey: ["quizzes", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("quizzes")
        .select("*, quiz_questions(count), quiz_responses(count), email_marketing_lists(name), customer_tags(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Quiz[];
    },
    enabled: !!tenantId,
  });

  // Get single quiz with questions
  const getQuiz = async (quizId: string) => {
    const { data, error } = await supabase
      .from("quizzes")
      .select("*, quiz_questions(*)")
      .eq("id", quizId)
      .single();
    
    if (error) throw error;
    
    // Sort questions by order_index
    if (data?.quiz_questions) {
      (data.quiz_questions as any[]).sort((a: any, b: any) => a.order_index - b.order_index);
    }
    
    return data as unknown as Quiz;
  };

  // Get quiz responses
  const getQuizResponses = async (quizId: string) => {
    const { data, error } = await supabase
      .from("quiz_responses")
      .select("*, email_marketing_subscribers(email, name)")
      .eq("quiz_id", quizId)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data;
  };

  // Create quiz
  const createQuiz = useMutation({
    mutationFn: async (data: QuizFormData) => {
      if (!tenantId) throw new Error("Tenant not found");
      
      const { data: quiz, error } = await supabase
        .from("quizzes")
        .insert({
          ...data,
          tenant_id: tenantId,
          status: 'draft',
        })
        .select()
        .single();
      
      if (error) throw error;
      return quiz;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success("Quiz criado com sucesso");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar quiz");
    },
  });

  // Update quiz
  const updateQuiz = useMutation({
    mutationFn: async ({ id, ...data }: Partial<QuizFormData> & { id: string }) => {
      const { error } = await supabase
        .from("quizzes")
        .update(data)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success("Quiz atualizado");
    },
  });

  // Delete quiz
  const deleteQuiz = useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase
        .from("quizzes")
        .delete()
        .eq("id", quizId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success("Quiz excluído");
    },
  });

  // Publish/unpublish quiz
  const togglePublish = useMutation({
    mutationFn: async ({ quizId, publish }: { quizId: string; publish: boolean }) => {
      const { error } = await supabase
        .from("quizzes")
        .update({ status: publish ? 'published' : 'draft' })
        .eq("id", quizId);
      
      if (error) throw error;
    },
    onSuccess: (_, { publish }) => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success(publish ? "Quiz publicado" : "Quiz despublicado");
    },
  });

  // Add question
  const addQuestion = useMutation({
    mutationFn: async ({ quizId, question }: { quizId: string; question: QuestionFormData }) => {
      // Get current max order_index
      const { data: existing } = await supabase
        .from("quiz_questions")
        .select("order_index")
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: false })
        .limit(1);
      
      const nextIndex = existing?.[0]?.order_index ?? -1;
      
      const insertData = {
        quiz_id: quizId,
        order_index: nextIndex + 1,
        step_type: question.step_type || 'question',
        type: question.type,
        question: question.question,
        description: question.description || null,
        media: question.media || null,
        is_required: question.is_required ?? true,
        options: question.options ?? null,
        mapping: question.mapping ?? null,
      };
      
      const { data, error } = await supabase
        .from("quiz_questions")
        .insert(insertData as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success("Etapa adicionada");
    },
  });

  // Update question
  const updateQuestion = useMutation({
    mutationFn: async ({ id, ...data }: Partial<QuestionFormData> & { id: string }) => {
      const { error } = await supabase
        .from("quiz_questions")
        .update(data)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success("Etapa atualizada");
    },
  });

  // Delete question
  const deleteQuestion = useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await supabase
        .from("quiz_questions")
        .delete()
        .eq("id", questionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success("Etapa removida");
    },
  });

  // Reorder questions
  const reorderQuestions = useMutation({
    mutationFn: async (questions: { id: string; order_index: number }[]) => {
      for (const q of questions) {
        await supabase
          .from("quiz_questions")
          .update({ order_index: q.order_index })
          .eq("id", q.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
  });

  return {
    quizzes,
    isLoading,
    refetch,
    getQuiz,
    getQuizResponses,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    togglePublish,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    tenantId,
  };
}
