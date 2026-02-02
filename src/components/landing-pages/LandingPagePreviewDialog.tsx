// =============================================
// LANDING PAGE PREVIEW DIALOG
// Preview modal for landing pages
// =============================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

  const { data: landingPage, isLoading } = useQuery({
    queryKey: ['ai-landing-page-preview', landingPageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_landing_pages')
        .select('name, slug, generated_html, generated_css, is_published')
        .eq('id', landingPageId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!landingPageId,
  });

  const renderPreview = () => {
    if (isLoading) {
      return <Skeleton className="w-full h-full" />;
    }

    if (!landingPage?.generated_html) {
      return (
        <div className="flex items-center justify-center h-full bg-muted/50">
          <p className="text-muted-foreground">
            Esta landing page ainda não foi gerada
          </p>
        </div>
      );
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; font-family: system-ui, sans-serif; }
            ${landingPage.generated_css || ''}
          </style>
        </head>
        <body>${landingPage.generated_html}</body>
      </html>
    `;

    return (
      <iframe
        srcDoc={fullHtml}
        className="w-full h-full border-0"
        title="Landing Page Preview"
      />
    );
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
                  onClick={() => window.open(`/lp/${landingPage.slug}`, '_blank')}
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
