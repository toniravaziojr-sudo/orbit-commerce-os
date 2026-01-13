// =============================================
// BUILDER VIEWPORT FRAME - Renders content in an iframe for real breakpoints
// This solves the root cause of responsive issues: Tailwind breakpoints
// respond to the actual viewport (iframe window), not container width
// =============================================

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { BlockRenderer } from './BlockRenderer';
import { hexToHsl } from '@/contexts/ThemeContext';

// Viewport dimensions (matching common device sizes)
export const VIEWPORT_SIZES = {
  desktop: { width: 1280, height: 800, label: 'Desktop' },
  tablet: { width: 768, height: 1024, label: 'Tablet' },
  mobile: { width: 390, height: 844, label: 'Mobile' },
} as const;

export type ViewportMode = keyof typeof VIEWPORT_SIZES;

interface BuilderViewportFrameProps {
  content: BlockNode;
  context: BlockRenderContext;
  viewport: ViewportMode;
  zoom: number;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onAddBlock?: (type: string, parentId: string, index: number) => void;
  onMoveBlock?: (blockId: string, direction: 'up' | 'down') => void;
  onDuplicateBlock?: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  onToggleHidden?: (blockId: string) => void;
  isPreviewMode?: boolean;
  isInteractMode?: boolean;
  isSafeMode?: boolean;
  storeSettings?: {
    primary_color?: string | null;
    secondary_color?: string | null;
    accent_color?: string | null;
  } | null;
}

// Component to render inside the iframe
function IframeContent({
  content,
  context,
  selectedBlockId,
  onSelectBlock,
  onAddBlock,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onToggleHidden,
  isPreviewMode,
  isInteractMode,
  isSafeMode,
}: Omit<BuilderViewportFrameProps, 'viewport' | 'zoom' | 'storeSettings'>) {
  return (
    <BlockRenderer
      node={content}
      context={context}
      isSelected={selectedBlockId === content.id}
      isEditing={!isPreviewMode && !isInteractMode}
      isInteractMode={isInteractMode}
      isSafeMode={isSafeMode}
      onSelect={isInteractMode ? undefined : onSelectBlock}
      onAddBlock={isInteractMode ? undefined : onAddBlock}
      onMoveBlock={isInteractMode ? undefined : onMoveBlock}
      onDuplicateBlock={isInteractMode ? undefined : onDuplicateBlock}
      onDeleteBlock={isInteractMode ? undefined : onDeleteBlock}
      onToggleHidden={isInteractMode ? undefined : onToggleHidden}
    />
  );
}

// Copy styles from parent document to iframe
function copyStylesToIframe(iframeDoc: Document) {
  // Copy all stylesheets
  const parentStyles = document.querySelectorAll('style, link[rel="stylesheet"]');
  parentStyles.forEach((style) => {
    const clone = style.cloneNode(true) as HTMLElement;
    iframeDoc.head.appendChild(clone);
  });

  // Copy CSS custom properties from :root
  const computedStyle = getComputedStyle(document.documentElement);
  const cssVars: string[] = [];
  
  // Get all CSS variables defined on :root
  for (const prop of computedStyle) {
    if (prop.startsWith('--')) {
      cssVars.push(`${prop}: ${computedStyle.getPropertyValue(prop)};`);
    }
  }
  
  if (cssVars.length > 0) {
    const varsStyle = iframeDoc.createElement('style');
    varsStyle.textContent = `:root { ${cssVars.join(' ')} }`;
    iframeDoc.head.appendChild(varsStyle);
  }
}

export function BuilderViewportFrame({
  content,
  context,
  viewport,
  zoom,
  selectedBlockId,
  onSelectBlock,
  onAddBlock,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onToggleHidden,
  isPreviewMode = false,
  isInteractMode = false,
  isSafeMode = false,
  storeSettings,
}: BuilderViewportFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeDoc, setIframeDoc] = useState<Document | null>(null);
  const [iframeBody, setIframeBody] = useState<HTMLElement | null>(null);
  const [stylesLoaded, setStylesLoaded] = useState(false);

  const { width, height } = VIEWPORT_SIZES[viewport];

  // Initialize iframe document
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      // Setup the document
      doc.open();
      doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>');
      doc.close();

      // Copy styles from parent
      copyStylesToIframe(doc);

      // Add base styles
      const baseStyle = doc.createElement('style');
      baseStyle.textContent = `
        *, *::before, *::after { box-sizing: border-box; }
        html { font-family: system-ui, -apple-system, sans-serif; }
        body { margin: 0; padding: 0; min-height: 100vh; background: hsl(var(--background)); color: hsl(var(--foreground)); }
        /* Ensure proper scrolling */
        html, body { height: auto; overflow-y: auto; overflow-x: hidden; }
      `;
      doc.head.appendChild(baseStyle);

      // Add theme CSS variables from store settings
      if (storeSettings) {
        const themeVars: string[] = [];
        if (storeSettings.primary_color) {
          themeVars.push(`--theme-primary: ${storeSettings.primary_color}`);
          const hsl = hexToHsl(storeSettings.primary_color);
          if (hsl && !hsl.startsWith('#')) {
            themeVars.push(`--primary: ${hsl}`);
          }
        }
        if (storeSettings.secondary_color) {
          themeVars.push(`--theme-secondary: ${storeSettings.secondary_color}`);
          const hsl = hexToHsl(storeSettings.secondary_color);
          if (hsl && !hsl.startsWith('#')) {
            themeVars.push(`--secondary: ${hsl}`);
          }
        }
        if (storeSettings.accent_color) {
          themeVars.push(`--theme-accent: ${storeSettings.accent_color}`);
          const hsl = hexToHsl(storeSettings.accent_color);
          if (hsl && !hsl.startsWith('#')) {
            themeVars.push(`--accent: ${hsl}`);
          }
        }
        if (themeVars.length > 0) {
          const themeStyle = doc.createElement('style');
          themeStyle.textContent = `:root { ${themeVars.join('; ')}; }`;
          doc.head.appendChild(themeStyle);
        }
      }

      setIframeDoc(doc);
      setIframeBody(doc.body);
      setStylesLoaded(true);
    };

    // Trigger load manually since we're creating the document
    handleLoad();

    // Also listen for actual load events in case of refresh
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [storeSettings]);

  // Handle clicks on iframe background to deselect
  useEffect(() => {
    if (!iframeDoc) return;

    const handleClick = (e: MouseEvent) => {
      // If clicking directly on body (not on a block), deselect
      if (e.target === iframeDoc.body) {
        onSelectBlock(null);
      }
    };

    iframeDoc.body.addEventListener('click', handleClick);
    return () => iframeDoc.body?.removeEventListener('click', handleClick);
  }, [iframeDoc, onSelectBlock]);

  // Update context with current viewport for conditional rendering inside blocks
  const viewportContext: BlockRenderContext = {
    ...context,
    viewport: viewport === 'mobile' ? 'mobile' : 'desktop',
  };

  return (
    <div 
      className="flex justify-center items-start min-h-full p-4"
      style={{ 
        transformOrigin: 'top center',
        transform: `scale(${zoom / 100})`,
      }}
    >
      <div
        className={`
          bg-background overflow-hidden transition-all duration-200
          ${viewport !== 'desktop' ? 'rounded-xl shadow-2xl border-4 border-muted/50' : 'shadow-md'}
        `}
        style={{
          width: `${width}px`,
          minHeight: `${height}px`,
        }}
      >
        {/* Device frame decorations for mobile/tablet */}
        {viewport === 'mobile' && (
          <div className="h-6 bg-muted/30 flex items-center justify-center gap-16 relative">
            <div className="absolute left-1/2 -translate-x-1/2 w-20 h-1 bg-muted rounded-full" />
          </div>
        )}
        
        <iframe
          ref={iframeRef}
          title="Builder Preview"
          className="w-full border-0"
          style={{
            height: viewport === 'mobile' ? `${height - 24}px` : `${height}px`,
            display: 'block',
          }}
        />

        {/* Render content inside iframe via portal */}
        {stylesLoaded && iframeBody && createPortal(
          <IframeContent
            content={content}
            context={viewportContext}
            selectedBlockId={selectedBlockId}
            onSelectBlock={onSelectBlock}
            onAddBlock={onAddBlock}
            onMoveBlock={onMoveBlock}
            onDuplicateBlock={onDuplicateBlock}
            onDeleteBlock={onDeleteBlock}
            onToggleHidden={onToggleHidden}
            isPreviewMode={isPreviewMode}
            isInteractMode={isInteractMode}
            isSafeMode={isSafeMode}
          />,
          iframeBody
        )}
      </div>
    </div>
  );
}
