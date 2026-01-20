import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import { useQuizzes, QuizQuestion, QuestionFormData } from "@/hooks/useQuizzes";

const questionTypes = [
  { value: 'single_choice', label: 'Escolha Única' },
  { value: 'multiple_choice', label: 'Múltipla Escolha' },
  { value: 'text', label: 'Texto Livre' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
  { value: 'name', label: 'Nome' },
] as const;

const optionSchema = z.object({
  value: z.string().min(1, "Valor é obrigatório"),
  label: z.string().min(1, "Texto é obrigatório"),
});

const formSchema = z.object({
  type: z.enum(['single_choice', 'multiple_choice', 'text', 'email', 'phone', 'name']),
  question: z.string().min(1, "Pergunta é obrigatória"),
  is_required: z.boolean().default(true),
  options: z.array(optionSchema).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface QuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  question?: QuizQuestion;
  onSuccess?: () => void;
}

export function QuestionDialog({ 
  open, 
  onOpenChange, 
  quizId, 
  question, 
  onSuccess 
}: QuestionDialogProps) {
  const { addQuestion, updateQuestion } = useQuizzes();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'single_choice',
      question: "",
      is_required: true,
      options: [{ value: "", label: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options",
  });

  const questionType = form.watch("type");
  const needsOptions = questionType === 'single_choice' || questionType === 'multiple_choice';

  // Populate form when editing
  useEffect(() => {
    if (question) {
      form.reset({
        type: question.type,
        question: question.question,
        is_required: question.is_required,
        options: question.options || [{ value: "", label: "" }],
      });
    } else {
      form.reset({
        type: 'single_choice',
        question: "",
        is_required: true,
        options: [{ value: "", label: "" }],
      });
    }
  }, [question, form, open]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const data: QuestionFormData = {
        type: values.type,
        question: values.question,
        is_required: values.is_required,
        options: needsOptions && values.options ? values.options.map(o => ({
          value: o.value || '',
          label: o.label || '',
        })) : undefined,
      };

      if (question) {
        await updateQuestion.mutateAsync({ id: question.id, ...data });
      } else {
        await addQuestion.mutateAsync({ quizId, question: data });
      }
      onSuccess?.();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {question ? "Editar Pergunta" : "Nova Pergunta"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Pergunta</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {questionTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {field.value === 'email' && "Captura o email do lead"}
                    {field.value === 'name' && "Captura o nome do lead"}
                    {field.value === 'phone' && "Captura o telefone do lead"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pergunta</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Qual seu tipo de pele?" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_required"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Obrigatória</FormLabel>
                    <FormDescription>
                      O usuário deve responder para continuar
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Options for choice questions */}
            {needsOptions && (
              <div className="space-y-3">
                <FormLabel>Opções de Resposta</FormLabel>
                
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                    
                    <FormField
                      control={form.control}
                      name={`options.${index}.label`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input 
                              placeholder="Texto da opção" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                // Auto-generate value from label
                                const value = e.target.value
                                  .toLowerCase()
                                  .normalize("NFD")
                                  .replace(/[\u0300-\u036f]/g, "")
                                  .replace(/[^a-z0-9]+/g, "_")
                                  .replace(/^_|_$/g, "");
                                form.setValue(`options.${index}.value`, value);
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ value: "", label: "" })}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Opção
                </Button>
              </div>
            )}

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
                {question ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
