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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, GripVertical, Image, Video, FileText, HelpCircle } from "lucide-react";
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
  image_url: z.string().optional(),
});

const formSchema = z.object({
  step_type: z.enum(['question', 'content']),
  type: z.enum(['single_choice', 'multiple_choice', 'text', 'email', 'phone', 'name']),
  question: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  media_type: z.enum(['none', 'image', 'video']).default('none'),
  media_url: z.string().optional(),
  media_alt: z.string().optional(),
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
      step_type: 'question',
      type: 'single_choice',
      question: "",
      description: "",
      media_type: 'none',
      media_url: "",
      media_alt: "",
      is_required: true,
      options: [{ value: "", label: "", image_url: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options",
  });

  const stepType = form.watch("step_type");
  const questionType = form.watch("type");
  const mediaType = form.watch("media_type");
  const needsOptions = stepType === 'question' && (questionType === 'single_choice' || questionType === 'multiple_choice');

  useEffect(() => {
    if (question) {
      form.reset({
        step_type: (question.step_type as 'question' | 'content') || 'question',
        type: question.type,
        question: question.question,
        description: question.description || "",
        media_type: question.media?.type || 'none',
        media_url: question.media?.url || "",
        media_alt: question.media?.alt || "",
        is_required: question.is_required,
        options: question.options?.length ? question.options.map(o => ({
          value: o.value || '',
          label: o.label || '',
          image_url: o.image_url || '',
        })) : [{ value: "", label: "", image_url: "" }],
      });
    } else {
      form.reset({
        step_type: 'question',
        type: 'single_choice',
        question: "",
        description: "",
        media_type: 'none',
        media_url: "",
        media_alt: "",
        is_required: true,
        options: [{ value: "", label: "", image_url: "" }],
      });
    }
  }, [question, form, open]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const media = values.media_type !== 'none' && values.media_url
        ? { type: values.media_type as 'image' | 'video', url: values.media_url, alt: values.media_alt || undefined }
        : null;

      const data: QuestionFormData = {
        step_type: values.step_type,
        type: values.step_type === 'content' ? 'text' : values.type,
        question: values.question,
        description: values.description || undefined,
        media,
        is_required: values.step_type === 'content' ? false : values.is_required,
        options: needsOptions && values.options ? values.options.map(o => ({
          value: o.value || '',
          label: o.label || '',
          image_url: o.image_url || undefined,
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

  const extractVideoId = (url: string) => {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/);
    if (ytMatch) return { provider: 'youtube', id: ytMatch[1] };
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return { provider: 'vimeo', id: vimeoMatch[1] };
    return null;
  };

  const mediaUrl = form.watch("media_url");
  const videoInfo = mediaType === 'video' && mediaUrl ? extractVideoId(mediaUrl) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {question ? "Editar Etapa" : "Nova Etapa"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Step Type Selector */}
            <FormField
              control={form.control}
              name="step_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Etapa</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => field.onChange('question')}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${
                        field.value === 'question' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <HelpCircle className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Pergunta</p>
                        <p className="text-xs text-muted-foreground">Coleta uma resposta</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange('content')}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${
                        field.value === 'content' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Conteúdo</p>
                        <p className="text-xs text-muted-foreground">Texto, imagem ou vídeo</p>
                      </div>
                    </button>
                  </div>
                </FormItem>
              )}
            />

            {/* Question Type (only for question steps) */}
            {stepType === 'question' && (
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Pergunta</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
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
            )}

            {/* Title / Question */}
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{stepType === 'content' ? 'Título da Etapa' : 'Pergunta'}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={stepType === 'content' ? "Ex: Antes de começar, assista este vídeo" : "Ex: Qual seu tipo de pele?"}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description (rich text) */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição {stepType === 'question' ? '(opcional)' : ''}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Texto de apoio, instruções ou contexto adicional..."
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Suporta **negrito**, *itálico* e [links](url)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Media */}
            <div className="space-y-3">
              <FormLabel>Mídia</FormLabel>
              <div className="flex gap-2">
                {(['none', 'image', 'video'] as const).map((mt) => (
                  <Button
                    key={mt}
                    type="button"
                    variant={mediaType === mt ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => form.setValue("media_type", mt)}
                  >
                    {mt === 'none' && 'Sem mídia'}
                    {mt === 'image' && <><Image className="h-4 w-4 mr-1" /> Imagem</>}
                    {mt === 'video' && <><Video className="h-4 w-4 mr-1" /> Vídeo</>}
                  </Button>
                ))}
              </div>

              {mediaType === 'image' && (
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="media_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="URL da imagem" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="media_alt"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Texto alternativo (acessibilidade)" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {mediaUrl && (
                    <div className="rounded-lg overflow-hidden border bg-muted/30 max-h-40">
                      <img src={mediaUrl} alt="Preview" className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>
              )}

              {mediaType === 'video' && (
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="media_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="URL do YouTube ou Vimeo" {...field} />
                        </FormControl>
                        <FormDescription>
                          Cole o link do YouTube ou Vimeo
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {videoInfo && (
                    <div className="rounded-lg overflow-hidden border aspect-video">
                      <iframe
                        src={
                          videoInfo.provider === 'youtube'
                            ? `https://www.youtube.com/embed/${videoInfo.id}`
                            : `https://player.vimeo.com/video/${videoInfo.id}`
                        }
                        className="w-full h-full"
                        allowFullScreen
                        title="Video preview"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Required toggle (only for questions) */}
            {stepType === 'question' && (
              <FormField
                control={form.control}
                name="is_required"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Obrigatória</FormLabel>
                      <FormDescription>O usuário deve responder para continuar</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {/* Options for choice questions */}
            {needsOptions && (
              <div className="space-y-3">
                <FormLabel>Opções de Resposta</FormLabel>
                
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-2 p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
                      
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

                    {/* Option image URL */}
                    <FormField
                      control={form.control}
                      name={`options.${index}.image_url`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="flex items-center gap-2 pl-6">
                              <Image className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <Input 
                                placeholder="URL da imagem (opcional)" 
                                className="h-8 text-xs"
                                {...field} 
                              />
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Option image preview */}
                    {form.watch(`options.${index}.image_url`) && (
                      <div className="pl-6">
                        <div className="w-16 h-16 rounded border overflow-hidden bg-muted/30">
                          <img 
                            src={form.watch(`options.${index}.image_url`)} 
                            alt="" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ value: "", label: "", image_url: "" })}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Opção
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
