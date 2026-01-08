import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Newspaper, Instagram, Facebook, Image, Check, Clock, Square, CheckSquare } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useMediaCalendarItems, MediaCalendarItem } from "@/hooks/useMediaCampaigns";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type PublicationType = "feed" | "stories" | "blog";
export type ChannelType = "instagram" | "facebook" | "feed_instagram" | "feed_facebook" | "story_instagram" | "story_facebook" | "blog";

interface PublicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  campaignId: string;
  existingItems: MediaCalendarItem[];
  editItem?: MediaCalendarItem | null;
  onBackToList?: () => void;
}

// Limites por tipo de publicação por card/dia
const PUBLICATION_LIMITS = {
  feed: 4,
  stories: 10,
  blog: 2,
};

const PUBLICATION_TYPES = [
  { id: "feed" as PublicationType, label: "Feed", icon: Image, description: "Post para o feed" },
  { id: "stories" as PublicationType, label: "Stories", icon: Clock, description: "Story temporário" },
  { id: "blog" as PublicationType, label: "Blog", icon: Newspaper, description: "Artigo para o blog" },
];

const CHANNELS = [
  { id: "instagram" as ChannelType, label: "Instagram", icon: Instagram },
  { id: "facebook" as ChannelType, label: "Facebook", icon: Facebook },
];

// Canais completos para edição (inclui tipo + rede)
const ALL_CHANNELS = [
  { id: "feed_instagram" as ChannelType, label: "Feed Instagram", icon: Instagram },
  { id: "feed_facebook" as ChannelType, label: "Feed Facebook", icon: Facebook },
  { id: "story_instagram" as ChannelType, label: "Story Instagram", icon: Instagram },
  { id: "story_facebook" as ChannelType, label: "Story Facebook", icon: Facebook },
  { id: "blog" as ChannelType, label: "Blog", icon: Newspaper },
];

const feedFormSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  copy: z.string().min(1, "Legenda é obrigatória"),
  cta: z.string().optional(),
  hashtags: z.string().optional(),
  scheduled_time: z.string().optional(),
  generation_prompt: z.string().optional(),
});

const storyFormSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  scheduled_time: z.string().optional(),
  generation_prompt: z.string().optional(),
});

const blogFormSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  copy: z.string().min(1, "Conteúdo é obrigatório"),
});

export function PublicationDialog({
  open,
  onOpenChange,
  date,
  campaignId,
  existingItems,
  editItem,
  onBackToList,
}: PublicationDialogProps) {
  const { currentTenant, user } = useAuth();
  const { createItem, updateItem, deleteItem } = useMediaCalendarItems(campaignId);

  const [step, setStep] = useState<"type" | "channels" | "details">("type");
  const [selectedType, setSelectedType] = useState<PublicationType | null>(null);
  // Agora suporta múltiplos canais do MESMO formato (feed_instagram + feed_facebook OU story_instagram + story_facebook)
  const [selectedChannels, setSelectedChannels] = useState<ChannelType[]>([]);

  const isEditing = !!editItem;

  // Calcula quantas publicações já existem por tipo neste dia
  const countsByType = useMemo(() => {
    return {
      feed: existingItems.filter(i => i.content_type === "image" || i.content_type === "carousel").length,
      stories: existingItems.filter(i => i.content_type === "story").length,
      blog: existingItems.filter(i => i.content_type === "text").length,
    };
  }, [existingItems]);

  // Verifica se pode criar mais publicações de cada tipo
  const canCreate = (type: PublicationType) => {
    // Se está editando, sempre pode (não conta como nova)
    if (isEditing) return true;
    return countsByType[type] < PUBLICATION_LIMITS[type];
  };

  // Forms para cada tipo
  const feedForm = useForm({
    resolver: zodResolver(feedFormSchema),
    defaultValues: {
      title: "",
      copy: "",
      cta: "",
      hashtags: "",
      scheduled_time: "10:00",
      generation_prompt: "",
    },
  });

  const storyForm = useForm({
    resolver: zodResolver(storyFormSchema),
    defaultValues: {
      title: "",
      scheduled_time: "10:00",
      generation_prompt: "",
    },
  });

  const blogForm = useForm({
    resolver: zodResolver(blogFormSchema),
    defaultValues: {
      title: "",
      copy: "",
    },
  });

  // Reset ao abrir/fechar ou quando muda editItem
  useEffect(() => {
    if (open) {
      if (editItem) {
        // Modo edição: preenche dados
        const type = editItem.content_type === "story" ? "stories" 
          : editItem.content_type === "text" ? "blog" 
          : "feed";
        setSelectedType(type);
        
        // Converte formatos legados para novos formatos - suporta múltiplos canais
        const platforms = editItem.target_platforms as string[] || [];
        const convertedChannels: ChannelType[] = [];
        
        platforms.forEach(p => {
          // Se já está no novo formato, mantém
          if (p.includes("_") || p === "blog") {
            convertedChannels.push(p as ChannelType);
          } else {
            // Converte formato legado baseado no tipo de conteúdo
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
        } else {
          blogForm.reset({
            title: editItem.title || "",
            copy: editItem.copy || "",
          });
        }
      } else {
        // Modo criação: reset
        setStep("type");
        setSelectedType(null);
        setSelectedChannels([]);
        feedForm.reset();
        storyForm.reset();
        blogForm.reset();
      }
    }
  }, [open, editItem]);

  const handleTypeSelect = (type: PublicationType) => {
    if (!canCreate(type)) {
      toast.error(`Limite de ${PUBLICATION_LIMITS[type]} ${type === "blog" ? "artigos" : type === "stories" ? "stories" : "posts"} por dia atingido`);
      return;
    }
    setSelectedType(type);
    if (type === "blog") {
      // Blog não precisa selecionar canal
      setStep("details");
    } else {
      setStep("channels");
    }
  };

  // Toggle de canal - permite múltipla seleção do mesmo formato
  const handleChannelToggle = (network: "instagram" | "facebook") => {
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
    // Se está editando, volta para a lista de publicações do dia
    if (isEditing) {
      onOpenChange(false);
      onBackToList?.();
      return;
    }
    
    if (step === "details") {
      // Volta para seleção de canais (ou tipo se for blog)
      if (selectedType === "blog") {
        setStep("type");
      } else {
        setStep("channels");
      }
    } else if (step === "channels") {
      setStep("type");
    }
  };

  const handleSubmitFeed = async (values: z.infer<typeof feedFormSchema>) => {
    if (!date || !currentTenant) return;

    const hashtags = values.hashtags
      ? values.hashtags.split(",").map(h => h.trim()).filter(Boolean)
      : [];

    const baseData = {
      title: values.title,
      copy: values.copy,
      cta: values.cta || null,
      hashtags,
      scheduled_time: values.scheduled_time ? `${values.scheduled_time}:00` : null,
      generation_prompt: values.generation_prompt || null,
      content_type: "image" as const,
      target_platforms: selectedChannels,
      status: "draft" as const,
    };

    if (isEditing && editItem) {
      await updateItem.mutateAsync({ id: editItem.id, ...baseData });
    } else {
      await createItem.mutateAsync({
        tenant_id: currentTenant.id,
        campaign_id: campaignId,
        scheduled_date: format(date, "yyyy-MM-dd"),
        ...baseData,
        reference_urls: null,
        asset_url: null,
        asset_thumbnail_url: null,
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
      });
    }

    onOpenChange(false);
    // Após salvar, reabre a lista do dia
    onBackToList?.();
  };

  const handleSubmitStory = async (values: z.infer<typeof storyFormSchema>) => {
    if (!date || !currentTenant) return;

    const baseData = {
      title: values.title,
      scheduled_time: values.scheduled_time ? `${values.scheduled_time}:00` : null,
      generation_prompt: values.generation_prompt || null,
      content_type: "story" as const,
      target_platforms: selectedChannels,
      status: "draft" as const,
    };

    if (isEditing && editItem) {
      await updateItem.mutateAsync({ id: editItem.id, ...baseData });
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
        asset_url: null,
        asset_thumbnail_url: null,
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
      });
    }

    onOpenChange(false);
    // Após salvar, reabre a lista do dia
    onBackToList?.();
  };

  const handleSubmitBlog = async (values: z.infer<typeof blogFormSchema>) => {
    if (!date || !currentTenant) return;

    const baseData = {
      title: values.title,
      copy: values.copy,
      content_type: "text" as const,
      target_platforms: ["blog"],
      status: "draft" as const,
    };

    if (isEditing && editItem) {
      await updateItem.mutateAsync({ id: editItem.id, ...baseData });
    } else {
      await createItem.mutateAsync({
        tenant_id: currentTenant.id,
        campaign_id: campaignId,
        scheduled_date: format(date, "yyyy-MM-dd"),
        ...baseData,
        cta: null,
        hashtags: [],
        scheduled_time: null,
        generation_prompt: null,
        reference_urls: null,
        asset_url: null,
        asset_thumbnail_url: null,
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
      });
    }

    onOpenChange(false);
    // Após salvar, reabre a lista do dia
    onBackToList?.();
  };

  const handleDelete = async () => {
    if (!editItem) return;
    await deleteItem.mutateAsync(editItem.id);
    onOpenChange(false);
  };

  const displayDate = date 
    ? format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Step 1: Tipo de publicação */}
        {step === "type" && (
          <>
            <DialogHeader>
              <DialogTitle>Nova Publicação</DialogTitle>
              <DialogDescription className="capitalize">{displayDate}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">Qual tipo de publicação você quer criar?</p>
              <div className="grid grid-cols-3 gap-3">
                {PUBLICATION_TYPES.map((type) => {
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
          </>
        )}

        {/* Step 2: Canal (só para feed/stories) */}
        {step === "channels" && (
          <>
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
          </>
        )}

        {/* Step 3: Detalhes - Feed */}
        {step === "details" && selectedType === "feed" && (
          <>
            <DialogHeader>
              <DialogTitle>{isEditing ? "Editar" : "Criar"} Post do Feed</DialogTitle>
              <DialogDescription className="capitalize">{displayDate}</DialogDescription>
            </DialogHeader>

            <Form {...feedForm}>
              <form onSubmit={feedForm.handleSubmit(handleSubmitFeed)} className="space-y-4">
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
                            setSelectedChannels(prev => 
                              prev.includes(channel.id) 
                                ? prev.filter(c => c !== channel.id)
                                : [...prev, channel.id]
                            );
                          }}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                            "hover:border-primary hover:bg-primary/5",
                            isSelected && "border-primary bg-primary/10"
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
                      <FormLabel>Legenda / Copy</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Escreva a legenda do post..." className="min-h-[80px]" {...field} />
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

                <FormField
                  control={feedForm.control}
                  name="generation_prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prompt para criativo (opcional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descreva o visual desejado..." className="min-h-[60px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="gap-2">
                  {isEditing && (
                    <Button type="button" variant="destructive" onClick={handleDelete} className="mr-auto">
                      Excluir
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={handleBack}>Voltar</Button>
                  <Button type="submit">{isEditing ? "Salvar" : "Criar"}</Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}

        {/* Step 3: Detalhes - Stories */}
        {step === "details" && selectedType === "stories" && (
          <>
            <DialogHeader>
              <DialogTitle>{isEditing ? "Editar" : "Criar"} Story</DialogTitle>
              <DialogDescription className="capitalize">{displayDate}</DialogDescription>
            </DialogHeader>

            <Form {...storyForm}>
              <form onSubmit={storyForm.handleSubmit(handleSubmitStory)} className="space-y-4">
                {/* Seletor de Canais - Múltipla seleção */}
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
                            setSelectedChannels(prev => 
                              prev.includes(channel.id) 
                                ? prev.filter(c => c !== channel.id)
                                : [...prev, channel.id]
                            );
                          }}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                            "hover:border-primary hover:bg-primary/5",
                            isSelected && "border-primary bg-primary/10"
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

                <FormField
                  control={storyForm.control}
                  name="generation_prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prompt para criativo</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descreva o visual do story..." className="min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="gap-2">
                  {isEditing && (
                    <Button type="button" variant="destructive" onClick={handleDelete} className="mr-auto">
                      Excluir
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={handleBack}>Voltar</Button>
                  <Button type="submit">{isEditing ? "Salvar" : "Criar"}</Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}

        {/* Step 3: Detalhes - Blog */}
        {step === "details" && selectedType === "blog" && (
          <>
            <DialogHeader>
              <DialogTitle>{isEditing ? "Editar" : "Criar"} Artigo do Blog</DialogTitle>
              <DialogDescription className="capitalize">{displayDate}</DialogDescription>
            </DialogHeader>

            <Form {...blogForm}>
              <form onSubmit={blogForm.handleSubmit(handleSubmitBlog)} className="space-y-4">
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

                <DialogFooter className="gap-2">
                  {isEditing && (
                    <Button type="button" variant="destructive" onClick={handleDelete} className="mr-auto">
                      Excluir
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={handleBack}>Voltar</Button>
                  <Button type="submit">{isEditing ? "Salvar" : "Criar"}</Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
