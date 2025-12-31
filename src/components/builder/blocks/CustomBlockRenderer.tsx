// =============================================
// CUSTOM BLOCK RENDERER - Renders imported HTML/CSS blocks
// =============================================

import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Code, AlertTriangle } from 'lucide-react';

interface CustomBlockRendererProps {
  customBlockId?: string;
  htmlContent?: string;
  cssContent?: string;
  blockName?: string;
  context?: any;
  isEditing?: boolean;
}

// Generate unique scope ID for CSS isolation
function generateScopeId(): string {
  return `cb-${Math.random().toString(36).substr(2, 9)}`;
}

// Sanitize HTML to remove dangerous elements
function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove style tags (we handle CSS separately)
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove iframes (except YouTube/Vimeo)
  sanitized = sanitized.replace(
    /<iframe(?![^>]*(?:youtube\.com|vimeo\.com|youtube-nocookie\.com))[^>]*>.*?<\/iframe>/gi,
    ''
  );
  
  // Remove event handlers (onclick, onload, onerror, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');
  
  // Remove data: URLs in src (potential XSS)
  sanitized = sanitized.replace(/src\s*=\s*["']data:[^"']*["']/gi, 'src=""');
  
  return sanitized;
}

// Scope CSS rules to a specific container
function scopeCss(css: string, scopeId: string): string {
  if (!css) return '';
  
  // Split CSS into rules and scope each one
  const rules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
  
  return rules.map(rule => {
    const [selector, ...rest] = rule.split('{');
    const declarations = rest.join('{');
    
    // Skip @rules (media queries, keyframes, etc.)
    if (selector.trim().startsWith('@')) {
      return rule;
    }
    
    // Scope each selector
    const scopedSelectors = selector.split(',').map(s => {
      const trimmed = s.trim();
      // Don't scope html, body, or :root
      if (trimmed === 'html' || trimmed === 'body' || trimmed === ':root') {
        return `.${scopeId}`;
      }
      return `.${scopeId} ${trimmed}`;
    }).join(', ');
    
    return `${scopedSelectors} {${declarations}`;
  }).join('\n');
}

export function CustomBlockRenderer({
  customBlockId,
  htmlContent,
  cssContent,
  blockName = 'Conteúdo Importado',
  context,
  isEditing = false,
}: CustomBlockRendererProps) {
  const [scopeId] = useState(generateScopeId);

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

  // Sanitize and scope
  const sanitizedHtml = useMemo(() => sanitizeHtml(finalHtml), [finalHtml]);
  const scopedCss = useMemo(() => scopeCss(finalCss, scopeId), [finalCss, scopeId]);

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
  if (!sanitizedHtml) {
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

  return (
    <div className="custom-block-wrapper relative">
      {/* Scoped CSS */}
      {scopedCss && (
        <style dangerouslySetInnerHTML={{ __html: scopedCss }} />
      )}
      
      {/* Editor indicator */}
      {isEditing && (
        <div className="absolute -top-6 right-0 bg-indigo-500 text-white text-xs px-2 py-1 rounded-t z-10 flex items-center gap-1 opacity-70">
          <Code className="w-3 h-3" />
          <span>{finalName}</span>
        </div>
      )}
      
      {/* Rendered content with scoped class */}
      <div 
        className={cn(
          scopeId,
          'custom-block-content',
          isEditing && 'ring-1 ring-indigo-500/30 rounded'
        )}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </div>
  );
}
