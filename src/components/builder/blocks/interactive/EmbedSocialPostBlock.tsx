import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Share2, Loader2 } from 'lucide-react';

export interface EmbedSocialPostBlockProps {
  url?: string;
  maxWidth?: number;
  isEditing?: boolean;
}

export function EmbedSocialPostBlock({ url, maxWidth = 550, isEditing }: EmbedSocialPostBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEmbed = useCallback(async (embedUrl: string) => {
    setLoading(true);
    setError(null);
    setHtml(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('meta-oembed', {
        body: { url: embedUrl, maxWidth },
      });

      if (fnError || !data?.success) {
        setError(data?.error || fnError?.message || 'Erro ao carregar embed');
        return;
      }

      setHtml(data.html);
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [maxWidth]);

  useEffect(() => {
    if (url && url.trim()) {
      fetchEmbed(url.trim());
    } else {
      setHtml(null);
      setError(null);
    }
  }, [url, fetchEmbed]);

  // Reload embed scripts after HTML is injected
  useEffect(() => {
    if (!html) return;
    
    const timer = setTimeout(() => {
      // Instagram
      if ((window as any).instgrm?.Embeds) {
        (window as any).instgrm.Embeds.process();
      }
      // Facebook
      if ((window as any).FB?.XFBML) {
        (window as any).FB.XFBML.parse();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [html]);

  if (!url && isEditing) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 min-h-[200px]">
        <Share2 className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground font-medium">Embed de Post Social</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Cole uma URL do Facebook, Instagram ou Threads nas propriedades
        </p>
      </div>
    );
  }

  if (!url) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-destructive/30 rounded-lg bg-destructive/5 min-h-[100px]">
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground mt-1">Verifique se a URL é de um post público</p>
      </div>
    );
  }

  if (!html) return null;

  return (
    <div 
      className="flex justify-center w-full"
      style={{ maxWidth: maxWidth || 550 }}
    >
      <div 
        className="w-full [&>iframe]:!max-w-full [&>blockquote]:!max-w-full"
        dangerouslySetInnerHTML={{ __html: html }} 
      />
    </div>
  );
}
