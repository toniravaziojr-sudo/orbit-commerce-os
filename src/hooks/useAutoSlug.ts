// =============================================
// USE AUTO SLUG - Single-responsibility hook for auto-generating slugs from names
// =============================================
// 
// Solves the universal slug auto-generation pattern:
// 1. When creating new entities, slug is auto-generated from name on every keystroke
// 2. If the user manually edits the slug field, auto-generation stops
// 3. On edit mode (existing entity), auto-generation is disabled by default
//
// Uses the centralized generateSlug() from slugPolicy.ts
//
// Usage:
//   const { slug, setSlug, handleNameChange, isAutoGenerating } = useAutoSlug({
//     initialSlug: existingEntity?.slug,
//     isEditing: !!existingEntity,
//   });

import { useState, useCallback, useRef } from 'react';
import { generateSlug } from '@/lib/slugPolicy';

interface UseAutoSlugOptions {
  /** Initial slug value (for edit mode) */
  initialSlug?: string;
  /** Whether we're editing an existing entity (disables auto-generation) */
  isEditing?: boolean;
}

interface UseAutoSlugReturn {
  /** Current slug value */
  slug: string;
  /** Set slug directly (marks as manually edited, stops auto-generation) */
  setSlug: (value: string) => void;
  /** Call this when the name field changes - auto-generates slug if not manually edited */
  handleNameChange: (name: string) => string;
  /** Whether slug is currently being auto-generated from name */
  isAutoGenerating: boolean;
  /** Reset to auto-generation mode (useful when clearing form) */
  resetAutoGeneration: () => void;
}

export function useAutoSlug({
  initialSlug = '',
  isEditing = false,
}: UseAutoSlugOptions = {}): UseAutoSlugReturn {
  const [slug, setSlugState] = useState(initialSlug);
  const [isManuallyEdited, setIsManuallyEdited] = useState(isEditing || !!initialSlug);
  const lastAutoSlugRef = useRef<string>(initialSlug);

  // User manually types in the slug field → stop auto-generating
  const setSlug = useCallback((value: string) => {
    const normalized = value.toLowerCase().replace(/\s+/g, '-');
    setSlugState(normalized);
    // Mark as manually edited only if the value differs from what auto-gen would produce
    setIsManuallyEdited(true);
  }, []);

  // Name field changes → auto-generate slug if not manually edited
  const handleNameChange = useCallback((name: string): string => {
    if (isManuallyEdited) return slug;
    
    const generated = generateSlug(name);
    setSlugState(generated);
    lastAutoSlugRef.current = generated;
    return generated;
  }, [isManuallyEdited, slug]);

  // Reset (e.g., when clearing form for new creation)
  const resetAutoGeneration = useCallback(() => {
    setIsManuallyEdited(false);
    setSlugState('');
    lastAutoSlugRef.current = '';
  }, []);

  return {
    slug,
    setSlug,
    handleNameChange,
    isAutoGenerating: !isManuallyEdited,
    resetAutoGeneration,
  };
}
