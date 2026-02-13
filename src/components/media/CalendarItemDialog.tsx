import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, Upload, Loader2, X } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useMediaCalendarItems, MediaCalendarItem } from "@/hooks/useMediaCampaigns";
import { useAuth } from "@/hooks/useAuth";
import { useSystemUpload } from "@/hooks/useSystemUpload";
import { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AssetVariantsGallery } from "./AssetVariantsGallery";
import { Separator } from "@/components/ui/separator";

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
  target_platforms: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const contentTypes: { value: MediaContentType; label: string }[] = [
  { value: "image", label: "🖼️ Imagem (Feed)" },
  { value: "carousel", label: "📸 Carrossel (Feed)" },
  { value: "story", label: "📱 Story" },
  { value: "text", label: "📝 Texto (Blog)" },
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
  { value: "instagram", label: "Instagram", icon: "🟠" },
  { value: "facebook", label: "Facebook", icon: "🔵" },
  { value: "blog", label: "Blog", icon: "📝" },
  { value: "tiktok", label: "TikTok", icon: "⚫" },
  { value: "linkedin", label: "LinkedIn", icon: "🔷" },
  { value: "youtube", label: "YouTube", icon: "🔴" },
];

interface CalendarItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MediaCalendarItem | null;
  date: Date | null;
  campaignId: string;
  selectedChannels?: string[];
}

export function CalendarItemDialog({
  open,
  onOpenChange,
  item,
  date,
  campaignId,
  selectedChannels = [],
}: CalendarItemDialogProps) {
  const { currentTenant, user } = useAuth();
  const { createItem, updateItem, deleteItem } = useMediaCalendarItems(campaignId);
  const { upload: uploadFile, isUploading } = useSystemUpload({ source: 'media_creative', subPath: 'criativos' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedAssetUrl, setUploadedAssetUrl] = useState<string | null>(null);
  const isEditing = !!item;

  // Determina se é campanha apenas para blog
  const isBlogOnly = selectedChannels.length === 1 && selectedChannels[0] === "blog";
  // Verifica se tem canais de redes sociais (não-blog)
  const hasSocialChannels = selectedChannels.some(c => ["instagram", "facebook", "tiktok", "linkedin", "youtube"].includes(c));

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
      target_platforms: ["instagram"],
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
        target_platforms: item.target_platforms || ["instagram"],
      });
      setUploadedAssetUrl(null);
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
        target_platforms: ["instagram"],
      });
      setUploadedAssetUrl(null);
    }
  }, [item, form]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const result = await uploadFile(file);
    if (result?.publicUrl) {
      setUploadedAssetUrl(result.publicUrl);
    }
  };

  const removeUploadedAsset = () => {
    setUploadedAssetUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (values: FormValues) => {
    const hashtags = values.hashtags
      ? values.hashtags.split(",").map((h) => h.trim()).filter(Boolean)
      : [];
    const platforms = values.target_platforms || [];

    // Keep the selected status — user decides when to approve
    let finalStatus = values.status as MediaItemStatus;

    if (isEditing && item) {
      const updateData: Record<string, unknown> = {
        id: item.id,
        title: values.title,
        copy: values.copy,
        cta: values.cta,
        content_type: values.content_type as MediaContentType,
        status: finalStatus,
        hashtags,
        target_platforms: platforms,
      };
      // If user uploaded a creative manually
      if (uploadedAssetUrl) {
        updateData.asset_url = uploadedAssetUrl;
      }
      await updateItem.mutateAsync(updateData as any);
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
        asset_url: uploadedAssetUrl || null,
        asset_thumbnail_url: uploadedAssetUrl || null,
        asset_metadata: {},
        status: finalStatus,
        target_channel: null,
        blog_post_id: null,
        published_blog_at: null,
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

        {/* Asset Variants Gallery */}
        {isEditing && item && (
          <>
            <AssetVariantsGallery 
              calendarItemId={item.id}
              onAssetApproved={(url) => {
                form.setValue("status", "asset_review");
              }}
            />
            <Separator />
          </>
        )}

        {/* Asset Preview (se já tem aprovado) */}
        {item?.asset_url && (
          <div className="rounded-lg border overflow-hidden bg-muted/50">
            <img 
              src={item.asset_url} 
              alt={item.title || "Asset"} 
              className="w-full h-48 object-cover"
            />
            <div className="p-2 flex items-center justify-between">
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                ✓ Criativo aprovado
              </Badge>
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

            {/* Plataformas/Canais - sempre mostrar para poder alterar */}
            <FormField
              control={form.control}
              name="target_platforms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Canais de publicação</FormLabel>
                  <div className="flex flex-wrap gap-3">
                    {platformOptions.map((platform) => {
                      const isChecked = field.value?.includes(platform.value) || false;
                      return (
                        <label
                          key={platform.value}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all",
                            isChecked
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const currentPlatforms = field.value || [];
                              if (checked) {
                                field.onChange([...currentPlatforms, platform.value]);
                              } else {
                                field.onChange(currentPlatforms.filter((p) => p !== platform.value));
                              }
                            }}
                          />
                          <span className="text-sm">
                            {platform.icon} {platform.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <FormDescription className="text-xs">
                    Selecione onde esta publicação será postada
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Horário de publicação - só mostrar se não for blog-only */}
            {!isBlogOnly && (
              <FormField
                control={form.control}
                name="scheduled_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário de publicação</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} className="w-40" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isBlogOnly ? "Título do Artigo" : "Título / Tema"}</FormLabel>
                  <FormControl>
                    <Input placeholder={isBlogOnly ? "Ex: 10 dicas para..." : "Ex: Lançamento de produto"} {...field} />
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
                  <FormLabel>{isBlogOnly ? "Conteúdo / Resumo" : "Legenda / Copy"} <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={isBlogOnly ? "Escreva o conteúdo ou resumo do artigo..." : "Escreva a legenda do post ou use 'Copys IA' no stepper..."}
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* CTA e Hashtags - só mostrar se tem redes sociais */}
            {hasSocialChannels && (
              <>
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
              </>
            )}

            {/* Prompt para criativo - só mostrar se NÃO for blog-only */}
            {!isBlogOnly && (
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
            )}

            {/* Upload manual de criativo */}
            {!isBlogOnly && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Upload de Criativo (opcional)</label>
                {uploadedAssetUrl && (
                  <div className="relative rounded-lg border overflow-hidden bg-muted/50">
                    <img src={uploadedAssetUrl} alt="Criativo" className="w-full h-32 object-cover" />
                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={removeUploadedAsset}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {!uploadedAssetUrl && (
                  <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                    {isUploading ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Enviando...</div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Upload className="h-4 w-4" />Clique para enviar imagem ou vídeo</div>
                    )}
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
                <p className="text-xs text-muted-foreground">Envie seu próprio criativo em vez de gerar com IA</p>
              </div>
            )}

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
