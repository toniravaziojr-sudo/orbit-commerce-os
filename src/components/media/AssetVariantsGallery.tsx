import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  RefreshCw,
  Loader2,
  ImageIcon,
  Sparkles,
  Package,
  Expand,
  Video,
  Play,
} from "lucide-react";
import {
  useAssetGenerations,
  useAllVariantsForItem,
  useGenerateImage,
  useGenerateVideo,
  useApproveVariant,
  useGetSignedUrl,
  VIDEO_DURATIONS,
  type AssetVariant,
  type VideoDuration,
} from "@/hooks/useAssetGeneration";
import { RegenerateFeedbackModal } from "./RegenerateFeedbackModal";
import { ImageLightbox } from "./ImageLightbox";

interface AssetVariantsGalleryProps {
  calendarItemId: string;
  onAssetApproved?: (url: string) => void;
}

export function AssetVariantsGallery({
  calendarItemId,
  onAssetApproved,
}: AssetVariantsGalleryProps) {
  const { currentTenant } = useAuth();
  const [selectedVariant, setSelectedVariant] = useState<AssetVariant | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
  const [variantToRegenerate, setVariantToRegenerate] = useState<string | null>(null);
  const [usePackshot, setUsePackshot] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<VideoDuration>(5);

  const { data: generations, isLoading: loadingGenerations } = useAssetGenerations(calendarItemId);
  const { data: variants, isLoading: loadingVariants } = useAllVariantsForItem(calendarItemId);
  
  // Check if tenant has packshot configured
  const { data: brandContext } = useQuery({
    queryKey: ["brand-context", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const { data } = await supabase
        .from("tenant_brand_context")
        .select("packshot_url")
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  const hasPackshot = !!brandContext?.packshot_url;
  
  const generateImage = useGenerateImage();
  const generateVideo = useGenerateVideo();
  const approveVariant = useApproveVariant();
  const getSignedUrl = useGetSignedUrl();

  const handleGenerateVideo = () => {
    generateVideo.mutate({ 
      calendarItemId, 
      duration: videoDuration,
      aspectRatio: "16:9",
    });
  };

  // Get signed URLs for variants
  useEffect(() => {
    if (!variants) return;

    const fetchSignedUrls = async () => {
      for (const variant of variants) {
        if (variant.public_url) {
          // Already has public URL (approved)
          setSignedUrls((prev) => ({ ...prev, [variant.id]: variant.public_url! }));
        } else if (variant.storage_path && !signedUrls[variant.id]) {
          try {
            const url = await getSignedUrl.mutateAsync(variant.id);
            if (url) {
              setSignedUrls((prev) => ({ ...prev, [variant.id]: url }));
            }
          } catch (error) {
            console.error("Error getting signed URL:", error);
          }
        }
      }
    };

    fetchSignedUrls();
  }, [variants]);

  const handleGenerate = () => {
    generateImage.mutate({ 
      calendarItemId, 
      variantCount: 1,
      usePackshot: usePackshot && hasPackshot,
    });
  };

  const handleApprove = async (variant: AssetVariant) => {
    const result = await approveVariant.mutateAsync(variant.id);
    if (result.public_url && onAssetApproved) {
      onAssetApproved(result.public_url);
    }
  };

  const handleRegenerate = (variantId: string) => {
    setVariantToRegenerate(variantId);
    setRegenerateModalOpen(true);
  };

  const handleOpenLightbox = (imageUrl: string) => {
    setLightboxImageUrl(imageUrl);
    setLightboxOpen(true);
  };

  const isGenerating = generations?.some(
    (g) => g.status === "queued" || g.status === "generating"
  );
  const isGeneratingVideo = generateVideo.isPending;

  const hasVariants = variants && variants.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Criativos Gerados
        </h4>
        <div className="flex items-center gap-4">
          {/* Packshot toggle */}
          {hasPackshot && (
            <div className="flex items-center gap-2">
              <Switch
                id="use-packshot"
                checked={usePackshot}
                onCheckedChange={setUsePackshot}
              />
              <Label htmlFor="use-packshot" className="text-sm flex items-center gap-1.5">
                <Package className="h-4 w-4" />
                Usar packshot
              </Label>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={generateImage.isPending || isGenerating}
          >
            {generateImage.isPending || isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
            <>
              <ImageIcon className="h-4 w-4 mr-2" />
              Gerar imagem
            </>
          )}
        </Button>
        
        {/* Video generation with duration selector */}
        <div className="flex items-center gap-2">
          <Select
            value={videoDuration.toString()}
            onValueChange={(v) => setVideoDuration(parseInt(v) as VideoDuration)}
          >
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIDEO_DURATIONS.map((d) => (
                <SelectItem key={d.value} value={d.value.toString()}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateVideo}
            disabled={isGeneratingVideo || isGenerating}
          >
            {isGeneratingVideo ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Video className="h-4 w-4 mr-2" />
                Gerar vídeo
              </>
            )}
          </Button>
        </div>
      </div>
    </div>

    {/* Packshot info */}
    {!hasPackshot && (
      <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
        💡 Configure um packshot em "Contexto de Marca" para preservar rótulos e embalagens
      </div>
    )}

      {/* Loading state */}
      {(loadingGenerations || loadingVariants) && (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      )}

      {/* Generating state */}
      {isGenerating && !hasVariants && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="aspect-square flex items-center justify-center bg-muted/50">
            <div className="text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Gerando...</span>
            </div>
          </Card>
        </div>
      )}

      {/* Variants grid */}
      {hasVariants && (
        <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
        {variants.map((variant) => {
          const mediaUrl = signedUrls[variant.id];
          const isApproved = !!variant.approved_at;
          const isVideo = variant.storage_path?.endsWith('.mp4') || 
                          (variant as any).mime_type === 'video/mp4';

          return (
            <Card
              key={variant.id}
              className={`relative overflow-hidden group cursor-pointer ${
                selectedVariant?.id === variant.id ? "ring-2 ring-primary" : ""
              } ${isApproved ? "ring-2 ring-green-500" : ""}`}
              onClick={() => setSelectedVariant(variant)}
            >
              {mediaUrl ? (
                isVideo ? (
                  <div className="relative w-full h-full">
                    <video
                      src={mediaUrl}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => e.currentTarget.play()}
                      onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/50 rounded-full p-2">
                        <Play className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    src={mediaUrl}
                    alt={`Variante ${variant.variant_index}`}
                    className="w-full h-auto max-h-48 object-contain bg-black/5"
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Approved badge */}
              {isApproved && (
                <Badge className="absolute top-2 left-2 bg-green-500">
                  <Check className="h-3 w-3 mr-1" />
                  Aprovado
                </Badge>
              )}

              {/* Expand button - always visible on hover */}
              {mediaUrl && !isVideo && (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenLightbox(mediaUrl);
                  }}
                >
                  <Expand className="h-4 w-4" />
                </Button>
              )}

              {/* Hover actions */}
              {!isApproved && mediaUrl && (
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(variant);
                      }}
                      disabled={approveVariant.isPending}
                    >
                      {approveVariant.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Aprovar
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerate(variant.id);
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}

          {/* Generating placeholder when adding more */}
          {isGenerating && (
            <Card className="aspect-square flex items-center justify-center bg-muted/50">
              <div className="text-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Gerando...</span>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loadingGenerations && !loadingVariants && !hasVariants && !isGenerating && (
        <Card className="p-8 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            Nenhum criativo gerado ainda
          </p>
          <Button type="button" onClick={handleGenerate} disabled={generateImage.isPending}>
            <Sparkles className="h-4 w-4 mr-2" />
            Gerar criativo com IA
          </Button>
        </Card>
      )}

      {/* Regenerate modal */}
      <RegenerateFeedbackModal
        open={regenerateModalOpen}
        onOpenChange={setRegenerateModalOpen}
        variantId={variantToRegenerate}
        onComplete={() => {
          setRegenerateModalOpen(false);
          setVariantToRegenerate(null);
        }}
      />

      {/* Image lightbox */}
      <ImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imageUrl={lightboxImageUrl}
        alt="Criativo gerado"
      />
    </div>
  );
}
