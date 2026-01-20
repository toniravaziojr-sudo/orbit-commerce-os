import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useQuizzes, Quiz, QuizFormData } from "@/hooks/useQuizzes";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  slug: z.string().min(1, "Slug é obrigatório").regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
  intro_text: z.string().optional(),
  outro_text: z.string().optional(),
  list_id: z.string().optional(),
  tag_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface QuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quiz?: Quiz;
  onSuccess?: (quiz: any) => void;
}

export function QuizDialog({ open, onOpenChange, quiz, onSuccess }: QuizDialogProps) {
  const { createQuiz, updateQuiz } = useQuizzes();
  const { lists } = useEmailMarketing();
  const { currentTenant } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch customer tags
  const { data: tags = [] } = useQuery({
    queryKey: ["customer-tags", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from("customer_tags")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      intro_text: "",
      outro_text: "",
      list_id: "",
      tag_id: "",
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (quiz) {
      form.reset({
        name: quiz.name,
        slug: quiz.slug,
        intro_text: quiz.intro_text || "",
        outro_text: quiz.outro_text || "",
        list_id: quiz.list_id || "",
        tag_id: quiz.tag_id || "",
      });
    } else {
      form.reset({
        name: "",
        slug: "",
        intro_text: "",
        outro_text: "",
        list_id: "",
        tag_id: "",
      });
    }
  }, [quiz, form, open]);

  // Auto-generate slug from name
  const nameValue = form.watch("name");
  useEffect(() => {
    if (!quiz && nameValue) {
      const slug = nameValue
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      form.setValue("slug", slug);
    }
  }, [nameValue, quiz, form]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const data: QuizFormData = {
        name: values.name,
        slug: values.slug,
        intro_text: values.intro_text || undefined,
        outro_text: values.outro_text || undefined,
        list_id: values.list_id || undefined,
        tag_id: values.tag_id || undefined,
      };

      if (quiz) {
        await updateQuiz.mutateAsync({ id: quiz.id, ...data });
        onSuccess?.(quiz);
      } else {
        const result = await createQuiz.mutateAsync(data);
        onSuccess?.(result);
      }
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{quiz ? "Editar Quiz" : "Novo Quiz"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Quiz</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Descubra seu tipo de pele" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug (URL)</FormLabel>
                  <FormControl>
                    <Input placeholder="descubra-seu-tipo-de-pele" {...field} />
                  </FormControl>
                  <FormDescription>
                    Usado na URL: /quiz/{field.value || "slug"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="intro_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Texto de Introdução</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Responda algumas perguntas para descobrir..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="outro_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Texto de Conclusão</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Obrigado por participar! Veja seu resultado..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="list_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lista de Email</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Nenhuma</SelectItem>
                        {lists.map((list: any) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Adicionar leads à lista
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tag_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Nenhuma</SelectItem>
                        {tags.map((tag: any) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Tag aplicada aos contatos
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {quiz ? "Salvar" : "Criar Quiz"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
