// =============================================
// LANDING PAGE PREVIEW DIALOG
// Preview modal for landing pages
// V5: Supports blocks (React) with HTML fallback
// =============================================

import { useState } from "react";
import { sanitizeAILandingPageHtml } from "@/lib/sanitizeAILandingPageHtml";
import { buildDocumentShell } from "@/lib/aiLandingPageShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAILandingPageUrl } from "@/hooks/useAILandingPageUrl";
import { BlockRenderer } from "@/components/builder/BlockRenderer";
import { BlockNode, BlockRenderContext } from "@/lib/builder/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Monitor, Smartphone, ExternalLink } from "lucide-react";

interface LandingPagePreviewDialogProps {
  landingPageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LandingPagePreviewDialog({
  landingPageId,
  open,
  onOpenChange,
}: LandingPagePreviewDialogProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const { currentTenant: tenant } = useAuth();

  // Get tenant's public URL
  const { baseUrl: tenantBaseUrl } = useAILandingPageUrl({
    tenantId: tenant?.id,
    tenantSlug: tenant?.slug,
  });

  const { data: landingPage, isLoading } = useQuery({
    queryKey: ['ai-landing-page-preview', landingPageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_landing_pages')
        .select('name, slug, generated_html, generated_css, generated_blocks, is_published')
        .eq('id', landingPageId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!landingPageId,
  });

  const hasBlocks = landingPage?.generated_blocks && 
    (landingPage.generated_blocks as any)?.children?.length > 0;

  const renderPreview = () => {
    if (isLoading) {
      return <Skeleton className="w-full h-full" />;
    }

    if (!landingPage?.generated_html && !hasBlocks) {
      return (
        <div className="flex items-center justify-center h-full bg-muted/50">
          <p className="text-muted-foreground">
            Esta landing page ainda não foi gerada
          </p>
        </div>
      );
    }

    // V5.4: Prioritize HTML rendering (iframe) for maximum visual quality
    if (landingPage?.generated_html) {
      const sanitizedHtml = sanitizeAILandingPageHtml(landingPage.generated_html);
      const fullHtml = buildDocumentShell(sanitizedHtml, {
        extraCss: landingPage.generated_css || undefined,
      });

      return (
        <iframe
          srcDoc={fullHtml}
          className="w-full h-full border-0"
          title="Landing Page Preview"
        />
      );
    }

    // Fallback: Render blocks via BlockRenderer (legacy V5 content)
    if (hasBlocks) {
      const blockContent = landingPage!.generated_blocks as unknown as BlockNode;
      const context: BlockRenderContext = {
        tenantSlug: tenant?.slug || '',
        isPreview: true,
        pageType: 'landing_page',
        viewport: viewMode === 'mobile' ? 'mobile' : 'desktop',
      };

      const contentChildren = (blockContent.children || []).filter(
        (node: BlockNode) => node.type !== 'Header' && node.type !== 'Footer'
      );
      const pageBg = (blockContent.props?.backgroundColor as string) || 'transparent';

      return (
        <div 
          className="w-full h-full overflow-auto"
          style={{ backgroundColor: pageBg === 'transparent' ? '#fff' : pageBg }}
        >
          {contentChildren.map((node: BlockNode) => (
            <BlockRenderer
              key={node.id}
              node={node}
              context={context}
              isEditing={false}
            />
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{landingPage?.name || 'Preview'}</DialogTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'desktop' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-r-none"
                  onClick={() => setViewMode('desktop')}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'mobile' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-l-none"
                  onClick={() => setViewMode('mobile')}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
              {landingPage?.is_published && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = tenantBaseUrl ? `${tenantBaseUrl}/ai-lp/${landingPage.slug}` : `/ai-lp/${landingPage.slug}`;
                    window.open(url, '_blank');
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Abrir
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-muted/30 flex items-center justify-center p-4 overflow-auto">
          <div
            className={`bg-white shadow-lg overflow-hidden transition-all duration-300 ${
              viewMode === 'mobile'
                ? 'w-[375px] h-[667px] rounded-[40px] border-[12px] border-gray-800'
                : 'w-full h-full rounded-lg'
            }`}
          >
            {renderPreview()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
