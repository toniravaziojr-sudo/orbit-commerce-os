import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Newspaper, Instagram, Facebook, Image, Check, Clock, Square, CheckSquare, Youtube, Video, Upload, X, Loader2, ExternalLink, Sparkles, AlertTriangle, Lock, RefreshCw, Info } from "lucide-react";
import { UniversalImageUploader } from "@/components/ui/UniversalImageUploader";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMediaCalendarItems, MediaCalendarItem } from "@/hooks/useMediaCampaigns";
import { useAuth } from "@/hooks/useAuth";
import { useSystemUpload } from "@/hooks/useSystemUpload";
import { useMediaMonthFolder } from "@/hooks/useMediaMonthFolder";
import { toast } from "sonner";
import { checkEditability, hasCriticalFieldChanged, useCalendarItemActions, type EditMode } from "@/hooks/useCalendarItemActions";
import { PlatformStatusPanel } from "./PlatformStatusPanel";

export type PublicationType = "feed" | "stories" | "blog" | "youtube";
export type ChannelType = "instagram" | "facebook" | "feed_instagram" | "feed_facebook" | "story_instagram" | "story_facebook" | "blog" | "youtube";

interface PublicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  campaignId: string;
  existingItems: MediaCalendarItem[];
  editItem?: MediaCalendarItem | null;
  onBackToList?: () => void;
  campaignStartDate?: string;
  campaignType?: "blog" | "social" | "youtube";
  /** When true, the editor is in "replace scheduling" mode */
  replaceMode?: boolean;
}

// Limites por tipo de publicação por card/dia
const PUBLICATION_LIMITS = {
  feed: 4,
  stories: 10,
  blog: 2,
  youtube: 3,
};

// Tipos para redes sociais (Feed/Stories)
const SOCIAL_PUBLICATION_TYPES = [
  { id: "feed" as PublicationType, label: "Feed", icon: Image, description: "Post para o feed" },
  { id: "stories" as PublicationType, label: "Stories", icon: Clock, description: "Story temporário" },
];

const BLOG_PUBLICATION_TYPE = { 
  id: "blog" as PublicationType, label: "Artigo", icon: Newspaper, description: "Post de blog" 
};

const YOUTUBE_PUBLICATION_TYPE = { 
  id: "youtube" as PublicationType, label: "Vídeo YouTube", icon: Youtube, description: "Vídeo para o canal" 
};

const CHANNELS = [
  { id: "instagram" as ChannelType, label: "Instagram", icon: Instagram },
  { id: "facebook" as ChannelType, label: "Facebook", icon: Facebook },
];

const ALL_CHANNELS = [
  { id: "feed_instagram" as ChannelType, label: "Feed Instagram", icon: Instagram },
  { id: "feed_facebook" as ChannelType, label: "Feed Facebook", icon: Facebook },
  { id: "story_instagram" as ChannelType, label: "Story Instagram", icon: Instagram },
  { id: "story_facebook" as ChannelType, label: "Story Facebook", icon: Facebook },
];

const feedFormSchema = z.object({
  title: z.string().optional(),
  copy: z.string().optional(),
  cta: z.string().optional(),
  hashtags: z.string().optional(),
  scheduled_time: z.string().optional(),
  generation_prompt: z.string().optional(),
});

const storyFormSchema = z.object({
  title: z.string().optional(),
  scheduled_time: z.string().optional(),
  generation_prompt: z.string().optional(),
});

const blogFormSchema = z.object({
  title: z.string().optional(),
  copy: z.string().optional(),
  scheduled_time: z.string().optional(),
});

const youtubeFormSchema = z.object({
  title: z.string().optional(),
  copy: z.string().optional(),
  tags: z.string().optional(),
  scheduled_time: z.string().optional(),
  generation_prompt: z.string().optional(),
});

// Status labels for the context banner
const statusBannerLabels: Record<string, string> = {
  draft: "Rascunho",
  suggested: "Sugerido",
  review: "Em Revisão",
  generating_asset: "Gerando Criativo",
  asset_review: "Revisão de Criativo",
  approved: "Aprovado",
  scheduled: "Agendado",
  publishing: "Publicando",
  published: "Publicado",
  failed: "Com Erros",
  partially_published: "Parcialmente Publicado",
  partially_failed: "Parcialmente Falhou",
  retry_pending: "Aguardando Retry",
  superseded: "Substituído",
  canceled: "Encerrado",
};

const statusBannerColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  suggested: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  scheduled: "bg-primary/10 text-primary",
  published: "bg-green-600/10 text-green-700 dark:text-green-300",
  failed: "bg-destructive/10 text-destructive",
  partially_published: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  partially_failed: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

export function PublicationDialog({
  open,
  onOpenChange,
  date,
  campaignId,
  existingItems,
  editItem,
  onBackToList,
  campaignStartDate,
  campaignType = "social",
  replaceMode = false,
}: PublicationDialogProps) {
  const { currentTenant, user } = useAuth();
  const { createItem, updateItem, deleteItem } = useMediaCalendarItems(campaignId);
  const { replaceScheduledItem } = useCalendarItemActions(campaignId);
  const mediaMonthFolderId = useMediaMonthFolder(campaignStartDate);
  const { upload: uploadFile, isUploading } = useSystemUpload({ source: 'media_creative', subPath: 'criativos', folderId: mediaMonthFolderId || undefined });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedAssetUrl, setUploadedAssetUrl] = useState<string | null>(null);

  const [step, setStep] = useState<"type" | "channels" | "details">("type");
  const [selectedType, setSelectedType] = useState<PublicationType | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<ChannelType[]>([]);

  const isEditing = !!editItem;

  // Determine editability for current item
  const editability = useMemo(() => {
    if (!editItem) return null;
    return checkEditability(editItem);
  }, [editItem]);

  const isReadOnly = editability?.isReadOnly || false;
  const isReplaceMode = replaceMode && editItem?.status === "scheduled";

  // Calcula quantas publicações já existem por tipo neste dia
  const countsByType = useMemo(() => {
    return {
      feed: existingItems.filter(i => i.content_type === "image" || i.content_type === "carousel").length,
      stories: existingItems.filter(i => i.content_type === "story").length,
      blog: existingItems.filter(i => i.content_type === "text").length,
      youtube: existingItems.filter(i => i.content_type === "video" && i.target_channel === "youtube").length,
    };
  }, [existingItems]);

  const canCreate = (type: PublicationType) => {
    if (isEditing) return true;
    return countsByType[type] < PUBLICATION_LIMITS[type];
  };

  // Forms para cada tipo
  const feedForm = useForm({
    resolver: zodResolver(feedFormSchema),
    defaultValues: {
      title: "", copy: "", cta: "", hashtags: "", scheduled_time: "10:00", generation_prompt: "",
    },
  });

  const storyForm = useForm({
    resolver: zodResolver(storyFormSchema),
    defaultValues: {
      title: "", scheduled_time: "10:00", generation_prompt: "",
    },
  });

  const blogForm = useForm({
    resolver: zodResolver(blogFormSchema),
    defaultValues: {
      title: "", copy: "", scheduled_time: "10:00",
    },
  });

  const youtubeForm = useForm({
    resolver: zodResolver(youtubeFormSchema),
    defaultValues: {
      title: "", copy: "", tags: "", scheduled_time: "10:00", generation_prompt: "",
    },
  });

  // Reset ao abrir/fechar ou quando muda editItem
  useEffect(() => {
    if (open) {
      setUploadedAssetUrl(null);
      if (editItem) {
        const type = editItem.content_type === "story" ? "stories" 
          : editItem.content_type === "text" ? "blog" 
          : (editItem.content_type === "video" && editItem.target_channel === "youtube") ? "youtube"
          : "feed";
        setSelectedType(type);
        
        const platforms = editItem.target_platforms as string[] || [];
        const convertedChannels: ChannelType[] = [];
        
        platforms.forEach(p => {
          if (p.includes("_") || p === "blog") {
            convertedChannels.push(p as ChannelType);
          } else {
            if (type === "stories") {
              convertedChannels.push(`story_${p}` as ChannelType);
            } else if (type === "feed") {
              convertedChannels.push(`feed_${p}` as ChannelType);
            } else {
              convertedChannels.push(p as ChannelType);
            }
          }
        });
        
        setSelectedChannels(convertedChannels);
        setStep("details");

        if (type === "feed") {
          feedForm.reset({
            title: editItem.title || "",
            copy: editItem.copy || "",
            cta: editItem.cta || "",
            hashtags: editItem.hashtags?.join(", ") || "",
            scheduled_time: editItem.scheduled_time?.slice(0, 5) || "10:00",
            generation_prompt: editItem.generation_prompt || "",
          });
        } else if (type === "stories") {
          storyForm.reset({
            title: editItem.title || "",
            scheduled_time: editItem.scheduled_time?.slice(0, 5) || "10:00",
            generation_prompt: editItem.generation_prompt || "",
          });
        } else if (type === "youtube") {
          youtubeForm.reset({
            title: editItem.title || "",
            copy: editItem.copy || "",
            tags: editItem.hashtags?.join(", ") || "",
            scheduled_time: editItem.scheduled_time?.slice(0, 5) || "10:00",
            generation_prompt: editItem.generation_prompt || "",
          });
        } else {
          blogForm.reset({
            title: editItem.title || "",
            copy: editItem.copy || "",
            scheduled_time: editItem.scheduled_time?.slice(0, 5) || "10:00",
          });
        }
      } else {
        if (campaignType === "blog") {
          setStep("details");
          setSelectedType("blog");
          setSelectedChannels([]);
        } else if (campaignType === "youtube") {
          setStep("details");
          setSelectedType("youtube");
          setSelectedChannels(["youtube"]);
        } else {
          setStep("type");
          setSelectedType(null);
          setSelectedChannels([]);
        }
        feedForm.reset();
        storyForm.reset();
        blogForm.reset();
        youtubeForm.reset();
      }
    }
  }, [open, editItem, campaignType]);

  const handleTypeSelect = (type: PublicationType) => {
    if (!canCreate(type)) {
      toast.error(`Limite de ${PUBLICATION_LIMITS[type]} ${type === "blog" ? "artigos" : type === "stories" ? "stories" : type === "youtube" ? "vídeos" : "posts"} por dia atingido`);
      return;
    }
    setSelectedType(type);
    if (type === "blog" || type === "youtube") {
      if (type === "youtube") setSelectedChannels(["youtube"]);
      setStep("details");
    } else {
      setStep("channels");
    }
  };

  const handleChannelToggle = (network: "instagram" | "facebook") => {
    if (isReadOnly) return;
    const prefix = selectedType === "stories" ? "story_" : "feed_";
    const channelId = `${prefix}${network}` as ChannelType;
    
    setSelectedChannels(prev => {
      if (prev.includes(channelId)) {
        return prev.filter(c => c !== channelId);
      } else {
        return [...prev, channelId];
      }
    });
  };

  const handleProceedToDetails = () => {
    if (selectedChannels.length === 0) {
      toast.error("Selecione pelo menos um canal");
      return;
    }
    setStep("details");
  };

  const handleBack = () => {
    if (isEditing) {
      onOpenChange(false);
      onBackToList?.();
      return;
    }
    
    if (step === "details") {
      if (campaignType === "blog") {
        onOpenChange(false);
        return;
      }
      setStep("channels");
    } else if (step === "channels") {
      setStep("type");
    }
  };

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

  // Build data and handle save with state-aware logic
  const handleSaveWithStateRules = async (baseData: Record<string, unknown>) => {
    if (!date || !currentTenant || !editItem) return;

    // Replace mode: use safe replacement
    if (isReplaceMode) {
      const newData: Record<string, unknown> = { ...baseData };
      if (uploadedAssetUrl) {
        newData.asset_url = uploadedAssetUrl;
      }
      await replaceScheduledItem.mutateAsync({ itemId: editItem.id, newData });
      onOpenChange(false);
      onBackToList?.();
      return;
    }

    // Approved item with critical field change → revert to review
    if (editItem.status === "approved") {
      const updatedFields: Partial<MediaCalendarItem> = {};
      if ("copy" in baseData) updatedFields.copy = baseData.copy as string;
      if ("target_platforms" in baseData) updatedFields.target_platforms = baseData.target_platforms as string[];
      if ("content_type" in baseData) updatedFields.content_type = baseData.content_type as any;
      if (uploadedAssetUrl) updatedFields.asset_url = uploadedAssetUrl;

      if (hasCriticalFieldChanged(editItem, updatedFields)) {
        baseData.status = "review";
        toast.info("Campos importantes foram alterados — o item voltou para revisão.");
      }
    }

    // Normal update
    const updateData: Record<string, unknown> = { id: editItem.id, ...baseData };
    if (uploadedAssetUrl) {
      updateData.asset_url = uploadedAssetUrl;
    }
    await updateItem.mutateAsync(updateData as any);
    onOpenChange(false);
    onBackToList?.();
  };

  const handleSubmitFeed = async (values: z.infer<typeof feedFormSchema>) => {
    if (!date || !currentTenant) return;

    const hashtags = values.hashtags
      ? values.hashtags.split(",").map(h => h.trim()).filter(Boolean)
      : [];

    const baseData: Record<string, unknown> = {
      title: values.title,
      copy: values.copy || null,
      cta: values.cta || null,
      hashtags,
      scheduled_time: values.scheduled_time ? `${values.scheduled_time}:00` : null,
      generation_prompt: values.generation_prompt || null,
      content_type: "image",
      target_platforms: selectedChannels,
      status: "draft",
    };

    if (isEditing && editItem) {
      await handleSaveWithStateRules(baseData);
    } else {
      if (uploadedAssetUrl) {
        baseData.asset_url = uploadedAssetUrl;
        baseData.asset_thumbnail_url = uploadedAssetUrl;
      }
      await createItem.mutateAsync({
        tenant_id: currentTenant.id,
        campaign_id: campaignId,
        scheduled_date: format(date, "yyyy-MM-dd"),
        ...baseData,
        reference_urls: null,
        asset_url: (baseData.asset_url as string) || null,
        asset_thumbnail_url: (baseData.asset_thumbnail_url as string) || null,
        asset_metadata: {},
        target_channel: null,
        blog_post_id: null,
        published_blog_at: null,
        published_at: null,
        publish_results: {},
        version: 1,
        edited_by: user?.id || null,
        edited_at: null,
        metadata: {},
      } as any);
      onOpenChange(false);
      onBackToList?.();
    }
  };

  const handleSubmitStory = async (values: z.infer<typeof storyFormSchema>) => {
    if (!date || !currentTenant) return;

    const baseData: Record<string, unknown> = {
      title: values.title,
      scheduled_time: values.scheduled_time ? `${values.scheduled_time}:00` : null,
      generation_prompt: values.generation_prompt || null,
      content_type: "story",
      target_platforms: selectedChannels,
      status: "draft",
    };

    if (isEditing && editItem) {
      await handleSaveWithStateRules(baseData);
    } else {
      await createItem.mutateAsync({
        tenant_id: currentTenant.id,
        campaign_id: campaignId,
        scheduled_date: format(date, "yyyy-MM-dd"),
        ...baseData,
        copy: null,
        cta: null,
        hashtags: [],
        reference_urls: null,
        asset_url: uploadedAssetUrl || null,
        asset_thumbnail_url: uploadedAssetUrl || null,
        asset_metadata: {},
        target_channel: null,
        blog_post_id: null,
        published_blog_at: null,
        published_at: null,
        publish_results: {},
        version: 1,
        edited_by: user?.id || null,
        edited_at: null,
        metadata: {},
      } as any);
      onOpenChange(false);
      onBackToList?.();
    }
  };

  const handleSubmitBlog = async (values: z.infer<typeof blogFormSchema>) => {
    if (!date || !currentTenant) return;

    const baseData: Record<string, unknown> = {
      title: values.title,
      copy: values.copy,
      content_type: "text",
      target_platforms: ["blog"],
      target_channel: "blog",
      status: "draft",
      scheduled_time: values.scheduled_time ? `${values.scheduled_time}:00` : null,
    };

    if (isEditing && editItem) {
      await handleSaveWithStateRules(baseData);
    } else {
      await createItem.mutateAsync({
        tenant_id: currentTenant.id,
        campaign_id: campaignId,
        scheduled_date: format(date, "yyyy-MM-dd"),
        ...baseData,
        cta: null,
        hashtags: [],
        generation_prompt: null,
        reference_urls: null,
        asset_url: null,
        asset_thumbnail_url: null,
        asset_metadata: {},
        blog_post_id: null,
        published_blog_at: null,
        published_at: null,
        publish_results: {},
        version: 1,
        edited_by: user?.id || null,
        edited_at: null,
        metadata: {},
      } as any);
      onOpenChange(false);
      onBackToList?.();
    }
  };

  const handleSubmitYoutube = async (values: z.infer<typeof youtubeFormSchema>) => {
    if (!date || !currentTenant) return;

    const tags = values.tags
      ? values.tags.split(",").map(t => t.trim()).filter(Boolean)
      : [];

    const baseData: Record<string, unknown> = {
      title: values.title,
      copy: values.copy,
      hashtags: tags,
      content_type: "video",
      target_platforms: ["youtube"],
      target_channel: "youtube",
      status: "draft",
      scheduled_time: values.scheduled_time ? `${values.scheduled_time}:00` : null,
      generation_prompt: values.generation_prompt || null,
    };

    if (isEditing && editItem) {
      await handleSaveWithStateRules(baseData);
    } else {
      await createItem.mutateAsync({
        tenant_id: currentTenant.id,
        campaign_id: campaignId,
        scheduled_date: format(date, "yyyy-MM-dd"),
        ...baseData,
        cta: null,
        reference_urls: null,
        asset_url: null,
        asset_thumbnail_url: null,
        asset_metadata: {},
        blog_post_id: null,
        published_blog_at: null,
        published_at: null,
        publish_results: {},
        version: 1,
        edited_by: user?.id || null,
        edited_at: null,
        metadata: {},
      } as any);
      onOpenChange(false);
      onBackToList?.();
    }
  };

  const handleDelete = async () => {
    if (!editItem) return;
    await deleteItem.mutateAsync(editItem.id);
    onOpenChange(false);
  };

  const displayDate = date 
    ? format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })
    : "";

  // Context banner for editing mode
  const renderContextBanner = () => {
    if (!isEditing || !editItem || !editability) return null;

    const status = editItem.status;

    // Replace mode banner
    if (isReplaceMode) {
      return (
        <div className="mx-5 mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Substituindo agendamento</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
              Ao salvar, o agendamento anterior será cancelado e o item voltará para aprovação com o mesmo horário.
            </p>
          </div>
        </div>
      );
    }

    // Read-only banners
    if (isReadOnly) {
      if (["partially_published", "partially_failed"].includes(status)) {
        return (
          <div className="mx-5 mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <Lock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Publicação parcial — somente leitura</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                Este item já foi publicado em algumas redes. Use "Reenviar pendentes" na lista do dia, ou "Duplicar" para criar nova versão.
              </p>
            </div>
          </div>
        );
      }
      if (status === "published") {
        return (
          <div className="mx-5 mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 flex items-start gap-2">
            <Lock className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-green-800 dark:text-green-200">Item publicado — somente leitura</p>
              <p className="text-[11px] text-green-600 dark:text-green-400 mt-0.5">
                Use "Duplicar" para criar uma nova versão a partir deste conteúdo.
              </p>
            </div>
          </div>
        );
      }
      return (
        <div className="mx-5 mt-3 p-3 rounded-lg bg-muted border border-border flex items-start gap-2">
          <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">Este item está em modo somente leitura.</p>
        </div>
      );
    }

    return null;
  };

  // Status context header
  const renderStatusHeader = () => {
    if (!isEditing || !editItem) return null;

    return (
      <div className="flex items-center gap-2 mx-5 mt-2 flex-wrap">
        <Badge className={cn("text-[10px] h-5", statusBannerColors[editItem.status] || "bg-muted text-muted-foreground")}>
          {statusBannerLabels[editItem.status] || editItem.status}
        </Badge>
        {editItem.version && editItem.version > 1 && (
          <Badge variant="outline" className="text-[10px] h-5">
            v{editItem.version}
          </Badge>
        )}
        {editItem.scheduled_time && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {editItem.scheduled_time.slice(0, 5)}
          </span>
        )}
      </div>
    );
  };

  // Platform status for read-only items
  const renderPlatformStatus = () => {
    if (!isEditing || !editItem) return null;
    if (!["scheduled", "publishing", "published", "failed", "partially_published", "partially_failed", "retry_pending"].includes(editItem.status)) return null;

    return (
      <div className="mx-5 mt-2">
        <PlatformStatusPanel calendarItemId={editItem.id} />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] flex flex-col overflow-hidden p-0">
        {/* Step 1: Tipo de publicação - APENAS PARA REDES SOCIAIS */}
        {step === "type" && campaignType === "social" && (
          <div className="p-5">
            <DialogHeader>
              <DialogTitle>Nova Publicação</DialogTitle>
              <DialogDescription className="capitalize">{displayDate}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">Qual tipo de publicação você quer criar?</p>
              <div className="grid grid-cols-2 gap-3">
                {SOCIAL_PUBLICATION_TYPES.map((type) => {
                  const Icon = type.icon;
                  const remaining = PUBLICATION_LIMITS[type.id] - countsByType[type.id];
                  const disabled = !canCreate(type.id);
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleTypeSelect(type.id)}
                      disabled={disabled}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                        "hover:border-primary hover:bg-primary/5",
                        "focus:outline-none focus:ring-2 focus:ring-primary",
                        disabled && "opacity-50 cursor-not-allowed hover:border-border hover:bg-transparent"
                      )}
                    >
                      <Icon className="h-8 w-8 text-muted-foreground" />
                      <span className="font-medium text-sm">{type.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {remaining} restantes
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Canal (só para feed/stories) */}
        {step === "channels" && (
          <div className="p-5">
            <DialogHeader>
              <DialogTitle>Selecionar Canais</DialogTitle>
              <DialogDescription>
                Selecione os canais para essa publicação (pode marcar ambos)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground text-center">
                {selectedType === "stories" ? "Stories" : "Feed"} pode ir para Instagram e/ou Facebook
              </p>
              <div className="flex gap-4 justify-center">
                {CHANNELS.map((channel) => {
                  const Icon = channel.icon;
                  const prefix = selectedType === "stories" ? "story_" : "feed_";
                  const channelId = `${prefix}${channel.id}` as ChannelType;
                  const isSelected = selectedChannels.includes(channelId);
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => handleChannelToggle(channel.id as "instagram" | "facebook")}
                      className={cn(
                        "relative flex flex-col items-center gap-2 p-6 rounded-lg border-2 transition-all",
                        "hover:border-primary hover:bg-primary/5",
                        isSelected && "border-primary bg-primary/10"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                      <Icon className={cn("h-10 w-10", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("font-medium", isSelected && "text-primary")}>{channel.label}</span>
                    </button>
                  );
                })}
              </div>
              {selectedChannels.length > 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  Selecionados: {selectedChannels.length} canal(is)
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleBack}>Voltar</Button>
              <Button onClick={handleProceedToDetails} disabled={selectedChannels.length === 0}>
                Continuar
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Detalhes - Feed */}
        {step === "details" && selectedType === "feed" && (
          <>
            <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-1">
              <DialogTitle className="text-base">
                {isReadOnly ? "Visualizar" : isReplaceMode ? "Substituir" : isEditing ? "Editar" : "Criar"} Post do Feed
              </DialogTitle>
              <DialogDescription className="capitalize text-xs">{displayDate}</DialogDescription>
            </DialogHeader>

            {renderStatusHeader()}
            {renderContextBanner()}
            {renderPlatformStatus()}

            <Form {...feedForm}>
              <form onSubmit={feedForm.handleSubmit(handleSubmitFeed)} className="flex flex-col flex-1 min-h-0">
                <fieldset disabled={isReadOnly} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto space-y-3 px-5 pb-2">
                {/* Seletor de Canais - Múltipla seleção */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Canais de publicação</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_CHANNELS.filter(c => c.id.startsWith("feed_")).map((channel) => {
                      const Icon = channel.icon;
                      const isSelected = selectedChannels.includes(channel.id);
                      const CheckIcon = isSelected ? CheckSquare : Square;
                      return (
                        <button
                          key={channel.id}
                          type="button"
                          onClick={() => {
                            if (isReadOnly) return;
                            setSelectedChannels(prev => 
                              prev.includes(channel.id) 
                                ? prev.filter(c => c !== channel.id)
                                : [...prev, channel.id]
                            );
                          }}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                            "hover:border-primary hover:bg-primary/5",
                            isSelected && "border-primary bg-primary/10",
                            isReadOnly && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          <CheckIcon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                          <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                          <span className={cn("text-sm", isSelected && "text-primary")}>{channel.label.replace("Feed ", "")}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <FormField
                  control={feedForm.control}
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
                  control={feedForm.control}
                  name="copy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legenda / Copy <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Textarea placeholder="Escreva a legenda do post ou adicione depois..." className="min-h-[60px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={feedForm.control}
                    name="cta"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CTA (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Link na bio!" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={feedForm.control}
                    name="scheduled_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={feedForm.control}
                  name="hashtags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hashtags</FormLabel>
                      <FormControl>
                        <Input placeholder="#marketing, #vendas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Criativo */}
                {!isReadOnly && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Criativo <span className="text-muted-foreground font-normal">(opcional)</span></label>
                  <UniversalImageUploader
                    value={uploadedAssetUrl || (isEditing ? editItem?.asset_url || '' : '')}
                    onChange={(url) => setUploadedAssetUrl(url || null)}
                    source="media_creative"
                    subPath="criativos"
                    accept="all"
                    aspectRatio="square"
                    placeholder="Enviar imagem ou vídeo"
                    showUrlTab={false}
                    disabled={isUploading}
                    maxSize={5}
                  />
                </div>
                )}

                {isReadOnly && editItem?.asset_url && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Criativo</label>
                    <div className="rounded-lg border bg-muted/30 p-2">
                      <img src={editItem.asset_url} alt="" className="max-h-40 w-full object-contain rounded" />
                    </div>
                  </div>
                )}

                {/* Prompt para criativo IA */}
                <FormField
                  control={feedForm.control}
                  name="generation_prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                        Prompt para Criativo IA (opcional)
                      </FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descreva como o criativo deve ser gerado pela IA..." className="min-h-[60px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pb-3" />
                </div>
                </fieldset>
                <DialogFooter className="flex-shrink-0 gap-2 px-5 py-3 border-t">
                  {isEditing && editability?.canDelete && (
                    <Button type="button" variant="destructive" onClick={handleDelete} className="mr-auto">
                      Excluir
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={handleBack}>
                    {isReadOnly ? "Fechar" : "Voltar"}
                  </Button>
                  {!isReadOnly && (
                    <Button type="submit" disabled={replaceScheduledItem.isPending}>
                      {replaceScheduledItem.isPending ? "Salvando..." : isReplaceMode ? "Substituir" : isEditing ? "Salvar" : "Criar"}
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </Form>
          </>
        )}

        {/* Step 3: Detalhes - Stories */}
        {step === "details" && selectedType === "stories" && (
          <>
            <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-1">
              <DialogTitle className="text-base">
                {isReadOnly ? "Visualizar" : isReplaceMode ? "Substituir" : isEditing ? "Editar" : "Criar"} Story
              </DialogTitle>
              <DialogDescription className="capitalize text-xs">{displayDate}</DialogDescription>
            </DialogHeader>

            {renderStatusHeader()}
            {renderContextBanner()}
            {renderPlatformStatus()}

            <Form {...storyForm}>
              <form onSubmit={storyForm.handleSubmit(handleSubmitStory)} className="flex flex-col flex-1 min-h-0">
                <fieldset disabled={isReadOnly} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto space-y-3 px-5 pb-2">
                {/* Seletor de Canais */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Canais de publicação</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_CHANNELS.filter(c => c.id.startsWith("story_")).map((channel) => {
                      const Icon = channel.icon;
                      const isSelected = selectedChannels.includes(channel.id);
                      const CheckIcon = isSelected ? CheckSquare : Square;
                      return (
                        <button
                          key={channel.id}
                          type="button"
                          onClick={() => {
                            if (isReadOnly) return;
                            setSelectedChannels(prev => 
                              prev.includes(channel.id) 
                                ? prev.filter(c => c !== channel.id)
                                : [...prev, channel.id]
                            );
                          }}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                            "hover:border-primary hover:bg-primary/5",
                            isSelected && "border-primary bg-primary/10",
                            isReadOnly && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          <CheckIcon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                          <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                          <span className={cn("text-sm", isSelected && "text-primary")}>{channel.label.replace("Story ", "")}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <FormField
                  control={storyForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título / Tema</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Bastidores da produção" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={storyForm.control}
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

                {/* Criativo */}
                {!isReadOnly && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Criativo <span className="text-muted-foreground font-normal">(opcional)</span></label>
                  <UniversalImageUploader
                    value={uploadedAssetUrl || (isEditing ? editItem?.asset_url || '' : '')}
                    onChange={(url) => setUploadedAssetUrl(url || null)}
                    source="media_creative_story"
                    subPath="criativos"
                    accept="all"
                    aspectRatio="square"
                    placeholder="Enviar imagem ou vídeo do story"
                    showUrlTab={false}
                    disabled={isUploading}
                  />
                </div>
                )}

                {isReadOnly && editItem?.asset_url && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Criativo</label>
                    <div className="rounded-lg border bg-muted/30 p-2">
                      <img src={editItem.asset_url} alt="" className="max-h-40 w-full object-contain rounded" />
                    </div>
                  </div>
                )}

                {/* Prompt para criativo IA */}
                <FormField
                  control={storyForm.control}
                  name="generation_prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                        Prompt para Criativo IA (opcional)
                      </FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descreva como o criativo deve ser gerado pela IA..." className="min-h-[60px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pb-3" />
                </div>
                </fieldset>
                <DialogFooter className="flex-shrink-0 gap-2 px-5 py-3 border-t">
                  {isEditing && editability?.canDelete && (
                    <Button type="button" variant="destructive" onClick={handleDelete} className="mr-auto">
                      Excluir
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={handleBack}>
                    {isReadOnly ? "Fechar" : "Voltar"}
                  </Button>
                  {!isReadOnly && (
                    <Button type="submit" disabled={replaceScheduledItem.isPending}>
                      {replaceScheduledItem.isPending ? "Salvando..." : isReplaceMode ? "Substituir" : isEditing ? "Salvar" : "Criar"}
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </Form>
          </>
        )}

        {/* Step 3: Detalhes - Blog */}
        {step === "details" && selectedType === "blog" && (
          <>
            <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-1">
              <DialogTitle className="text-base">
                {isReadOnly ? "Visualizar" : isReplaceMode ? "Substituir" : isEditing ? "Editar" : "Criar"} Artigo do Blog
              </DialogTitle>
              <DialogDescription className="capitalize text-xs">{displayDate}</DialogDescription>
            </DialogHeader>

            {renderStatusHeader()}
            {renderContextBanner()}
            {renderPlatformStatus()}

            <Form {...blogForm}>
              <form onSubmit={blogForm.handleSubmit(handleSubmitBlog)} className="flex flex-col flex-1 min-h-0">
                <fieldset disabled={isReadOnly} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto space-y-3 px-5 pb-2">
                <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                  📝 Artigos de Blog são apenas texto. Não há geração de imagem para este tipo de publicação.
                </div>

                <FormField
                  control={blogForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título do Artigo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 10 dicas para..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={blogForm.control}
                  name="copy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conteúdo / Resumo</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Escreva o conteúdo ou resumo do artigo..." className="min-h-[150px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={blogForm.control}
                  name="scheduled_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário de Publicação</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                </div>
                </fieldset>
                <DialogFooter className="flex-shrink-0 gap-2 px-5 py-3 border-t">
                  {isEditing && editability?.canDelete && (
                    <Button type="button" variant="destructive" onClick={handleDelete} className="mr-auto">
                      Excluir
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={handleBack}>
                    {isReadOnly ? "Fechar" : "Voltar"}
                  </Button>
                  {!isReadOnly && (
                    <Button type="submit" disabled={replaceScheduledItem.isPending}>
                      {replaceScheduledItem.isPending ? "Salvando..." : isReplaceMode ? "Substituir" : isEditing ? "Salvar" : "Criar"}
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </Form>
          </>
        )}

        {/* Step 3: Detalhes - YouTube */}
        {step === "details" && selectedType === "youtube" && (
          <>
            <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-1">
              <DialogTitle className="text-base">
                {isReadOnly ? "Visualizar" : isReplaceMode ? "Substituir" : isEditing ? "Editar" : "Criar"} Vídeo do YouTube
              </DialogTitle>
              <DialogDescription className="capitalize text-xs">{displayDate}</DialogDescription>
            </DialogHeader>

            {renderStatusHeader()}
            {renderContextBanner()}
            {renderPlatformStatus()}

            <Form {...youtubeForm}>
              <form onSubmit={youtubeForm.handleSubmit(handleSubmitYoutube)} className="flex flex-col flex-1 min-h-0">
                <fieldset disabled={isReadOnly} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto scrollbar-thin space-y-3 px-5 pb-2" style={{ maxHeight: 'calc(80vh - 130px)' }}>
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive flex items-center gap-2">
                  <Youtube className="h-4 w-4 flex-shrink-0" />
                  <span>Uploads para YouTube consomem créditos (16+ por vídeo). Certifique-se de ter saldo suficiente.</span>
                </div>

                <FormField
                  control={youtubeForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título do Vídeo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Tutorial completo de..." maxLength={100} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={youtubeForm.control}
                  name="copy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descrição completa do vídeo..." className="min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={youtubeForm.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags (separadas por vírgula)</FormLabel>
                        <FormControl>
                          <Input placeholder="marketing, vendas, dicas" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={youtubeForm.control}
                    name="scheduled_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário de Publicação</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={youtubeForm.control}
                  name="generation_prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas / Roteiro (opcional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Notas sobre o vídeo, roteiro, etc..." className="min-h-[60px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                </div>
                </fieldset>
                <DialogFooter className="flex-shrink-0 gap-2 px-5 py-3 border-t">
                  {isEditing && editability?.canDelete && (
                    <Button type="button" variant="destructive" onClick={handleDelete} className="mr-auto">
                      Excluir
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={handleBack}>
                    {isReadOnly ? "Fechar" : "Voltar"}
                  </Button>
                  {!isReadOnly && (
                    <Button type="submit" disabled={replaceScheduledItem.isPending}>
                      {replaceScheduledItem.isPending ? "Salvando..." : isReplaceMode ? "Substituir" : isEditing ? "Salvar" : "Criar"}
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
