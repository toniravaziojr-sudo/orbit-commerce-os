// =============================================
// CUSTOM BLOCK RENDERER - Now uses IsolatedCustomBlock (iframe) for 100% CSS isolation
// This is a wrapper that maintains backwards compatibility
// =============================================

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { IsolatedCustomBlock } from './IsolatedCustomBlock';
import { AlertTriangle } from 'lucide-react';

interface CustomBlockRendererProps {
  customBlockId?: string;
  htmlContent?: string;
  cssContent?: string;
  blockName?: string;
  baseUrl?: string; // Source URL for resolving relative paths
  context?: any;
  isEditing?: boolean;
}

export function CustomBlockRenderer({
  customBlockId,
  htmlContent,
  cssContent,
  blockName = 'Conteúdo Importado',
  baseUrl,
  context,
  isEditing = false,
}: CustomBlockRendererProps) {
  // Fetch custom block data if customBlockId is provided
  const { data: customBlock, isLoading } = useQuery({
    queryKey: ['custom-block', customBlockId],
    queryFn: async () => {
      if (!customBlockId) return null;
      
      const { data, error } = await supabase
        .from('custom_blocks')
        .select('*')
        .eq('id', customBlockId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!customBlockId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Determine final HTML and CSS to use
  const finalHtml = customBlock?.html_template || htmlContent || '';
  const finalCss = customBlock?.css_snapshot || cssContent || '';
  const finalName = customBlock?.name || blockName;
  // Use source_url from custom_blocks table or prop
  const finalBaseUrl = customBlock?.source_url || baseUrl;

  // Loading state
  if (customBlockId && isLoading) {
    return (
      <div className="p-4 bg-muted/50 rounded animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-2" />
        <div className="h-20 bg-muted rounded" />
      </div>
    );
  }

  // Error state: no content
  if (!finalHtml) {
    if (isEditing) {
      return (
        <div className="p-4 bg-amber-500/10 border border-amber-500 rounded text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>Bloco customizado sem conteúdo: {finalName}</span>
        </div>
      );
    }
    return null;
  }

  // Use the new IsolatedCustomBlock with iframe for 100% CSS isolation
  return (
    <IsolatedCustomBlock
      htmlContent={finalHtml}
      cssContent={finalCss}
      blockName={finalName}
      baseUrl={finalBaseUrl}
      isEditing={isEditing}
    />
  );
}
