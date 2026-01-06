import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMediaCalendarItems, MediaCalendarItem } from "@/hooks/useMediaCampaigns";
import { useAuth } from "@/hooks/useAuth";
import { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MediaContentType = Database["public"]["Enums"]["media_content_type"];
type MediaItemStatus = Database["public"]["Enums"]["media_item_status"];

const formSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  copy: z.string().optional(),
  cta: z.string().optional(),
  content_type: z.string(),
  status: z.string(),
  hashtags: z.string().optional(),
  generation_prompt: z.string().optional(),
  scheduled_time: z.string().optional(),
  target_platforms: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const contentTypes: { value: MediaContentType; label: string }[] = [
  { value: "image", label: "🖼️ Imagem" },
  { value: "video", label: "🎬 Vídeo" },
  { value: "carousel", label: "📸 Carrossel" },
  { value: "story", label: "📱 Story" },
  { value: "reel", label: "🎞️ Reel" },
  { value: "text", label: "📝 Texto" },
];

const itemStatuses: { value: MediaItemStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "suggested", label: "Sugerido" },
  { value: "review", label: "Em revisão" },
  { value: "approved", label: "Aprovado" },
  { value: "generating_asset", label: "Gerando asset" },
  { value: "asset_review", label: "Revisar asset" },
  { value: "scheduled", label: "Agendado" },
  { value: "skipped", label: "Ignorar" },
];

const platformOptions = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
];

interface CalendarItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MediaCalendarItem | null;
  date: Date | null;
  campaignId: string;
}

export function CalendarItemDialog({
  open,
  onOpenChange,
  item,
  date,
  campaignId,
}: CalendarItemDialogProps) {
  const { currentTenant, user } = useAuth();
  const { createItem, updateItem, deleteItem } = useMediaCalendarItems(campaignId);
  const isEditing = !!item;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      copy: "",
      cta: "",
      content_type: "image",
      status: "draft",
      hashtags: "",
      generation_prompt: "",
      scheduled_time: "10:00",
      target_platforms: "instagram",
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        title: item.title || "",
        copy: item.copy || "",
        cta: item.cta || "",
        content_type: item.content_type,
        status: item.status,
        hashtags: item.hashtags?.join(", ") || "",
        generation_prompt: item.generation_prompt || "",
        scheduled_time: item.scheduled_time?.slice(0, 5) || "10:00",
        target_platforms: item.target_platforms?.join(", ") || "instagram",
      });
    } else {
      form.reset({
        title: "",
        copy: "",
        cta: "",
        content_type: "image",
        status: "draft",
        hashtags: "",
        generation_prompt: "",
        scheduled_time: "10:00",
        target_platforms: "instagram",
      });
    }
  }, [item, form]);

  const onSubmit = async (values: FormValues) => {
    const hashtags = values.hashtags
      ? values.hashtags.split(",").map((h) => h.trim()).filter(Boolean)
      : [];
    const platforms = values.target_platforms
      ? values.target_platforms.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

    if (isEditing && item) {
      await updateItem.mutateAsync({
        id: item.id,
        title: values.title,
        copy: values.copy,
        cta: values.cta,
        content_type: values.content_type as MediaContentType,
        status: values.status as MediaItemStatus,
        hashtags,
        target_platforms: platforms,
      });
    } else if (date && currentTenant) {
      await createItem.mutateAsync({
        tenant_id: currentTenant.id,
        campaign_id: campaignId,
        scheduled_date: format(date, "yyyy-MM-dd"),
        scheduled_time: values.scheduled_time ? `${values.scheduled_time}:00` : null,
        content_type: values.content_type as MediaContentType,
        title: values.title,
        copy: values.copy || null,
        cta: values.cta || null,
        hashtags,
        generation_prompt: values.generation_prompt || null,
        reference_urls: null,
        asset_url: null,
        asset_thumbnail_url: null,
        asset_metadata: {},
        status: values.status as MediaItemStatus,
        target_platforms: platforms,
        published_at: null,
        publish_results: {},
        version: 1,
        edited_by: user?.id || null,
        edited_at: null,
        metadata: {},
      });
    }

    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!item) return;
    await deleteItem.mutateAsync(item.id);
    onOpenChange(false);
  };

  const displayDate = item?.scheduled_date 
    ? format(new Date(item.scheduled_date), "EEEE, dd 'de' MMMM", { locale: ptBR })
    : date 
    ? format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Item" : "Novo Item"}</DialogTitle>
          <DialogDescription className="capitalize">
            {displayDate}
          </DialogDescription>
        </DialogHeader>

        {/* Asset Preview */}
        {item?.asset_url && (
          <div className="rounded-lg border overflow-hidden bg-muted/50">
            <img 
              src={item.asset_url} 
              alt={item.title || "Asset"} 
              className="w-full h-48 object-cover"
            />
            <div className="p-2 flex items-center justify-between">
              <Badge variant="outline">Asset anexado</Badge>
              <Button variant="ghost" size="sm" asChild>
                <a href={item.asset_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Abrir
                </a>
              </Button>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="content_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de conteúdo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {itemStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scheduled_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário de publicação</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="target_platforms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plataformas</FormLabel>
                    <FormControl>
                      <Input placeholder="instagram, facebook" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Separadas por vírgula
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título / Tema</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Lançamento de produto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="copy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legenda / Copy</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Escreva a legenda do post..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Call to Action (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Link na bio!" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hashtags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hashtags (separadas por vírgula)</FormLabel>
                  <FormControl>
                    <Input placeholder="#marketing, #vendas, #ecommerce" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="generation_prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt para gerar imagem/vídeo</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva detalhadamente o visual que você quer para este conteúdo..."
                      className="min-h-[60px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Este prompt será usado pela IA para gerar o criativo
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              {isEditing && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={deleteItem.isPending}
                  className="mr-auto"
                >
                  Excluir
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
                {isEditing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
