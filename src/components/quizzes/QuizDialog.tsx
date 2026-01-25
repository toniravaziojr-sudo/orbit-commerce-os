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
import { Loader2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuizzes, Quiz, QuizFormData } from "@/hooks/useQuizzes";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";
import { useCustomerTags } from "@/hooks/useCustomers";

const colorOptions = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", 
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280"
];

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
  const { tags, isLoading: isLoadingTags, createTag } = useCustomerTags();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Inline tag creator state
  const [showTagCreator, setShowTagCreator] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(colorOptions[0]);

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

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    const result = await createTag.mutateAsync({
      name: newTagName.trim(),
      color: newTagColor,
    });

    // Auto-select the newly created tag
    if (result?.id) {
      form.setValue("tag_id", result.id);
    }

    setNewTagName("");
    setNewTagColor(colorOptions[0]);
    setShowTagCreator(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
                      value={field.value || undefined}
                      onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhuma</SelectItem>
                        {(lists || []).map((list: any) => (
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
                  <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel>Tag</FormLabel>
                    <div className="space-y-2">
                      <Select
                        value={field.value || undefined}
                        onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingTags ? "Carregando..." : "Selecione..."} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhuma</SelectItem>
                          {(tags || []).map((tag: any) => (
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

                      {/* Quick tag badges */}
                      {tags.length > 0 && !showTagCreator && (
                        <div className="flex flex-wrap gap-1">
                          {tags.slice(0, 3).map((tag: any) => (
                            <Badge
                              key={tag.id}
                              variant="outline"
                              className="cursor-pointer hover:bg-accent text-xs"
                              style={{ borderColor: tag.color, color: tag.color }}
                              onClick={() => form.setValue("tag_id", tag.id)}
                            >
                              <span
                                className="h-2 w-2 rounded-full mr-1"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                            </Badge>
                          ))}
                          {tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Button to show inline tag creator */}
                      {!showTagCreator && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-1 text-xs"
                          onClick={() => setShowTagCreator(true)}
                        >
                          <Plus className="h-3 w-3" />
                          Criar nova tag
                        </Button>
                      )}

                      {/* Inline tag creator */}
                      {showTagCreator && (
                        <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Nova Tag</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                setShowTagCreator(false);
                                setNewTagName("");
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <Input
                            placeholder="Nome da tag"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            className="h-8 text-sm"
                          />

                          <div className="flex flex-wrap gap-1.5">
                            {colorOptions.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                                  newTagColor === color ? 'border-foreground scale-110' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => setNewTagColor(color)}
                              />
                            ))}
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            className="w-full"
                            disabled={!newTagName.trim() || createTag.isPending}
                            onClick={handleCreateTag}
                          >
                            {createTag.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            Criar Tag
                          </Button>
                        </div>
                      )}
                    </div>
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
