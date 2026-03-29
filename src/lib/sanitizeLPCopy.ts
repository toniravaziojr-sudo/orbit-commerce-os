// =============================================
// SANITIZE LP COPY — Strip markdown from AI text
// Removes **, *, __, etc. from copy before render
// =============================================

/**
 * Strips markdown formatting from AI-generated copy text.
 * Handles: **bold**, *italic*, __underline__, _italic_
 */
export function sanitizeLPCopy(text: string): string {
  if (!text) return text;
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/__(.+?)__/g, '$1')         // __underline__
    .replace(/\*(.+?)\*/g, '$1')         // *italic*
    .replace(/_(.+?)_/g, '$1')           // _italic_
    .replace(/~~(.+?)~~/g, '$1')         // ~~strikethrough~~
    .replace(/`(.+?)`/g, '$1')           // `code`
    .replace(/^#+\s+/gm, '')             // # headings
    .replace(/^\s*[-*+]\s+/gm, '• ')     // - list items → bullet
    .trim();
}

/**
 * Sanitizes all string props in an LP section recursively.
 */
export function sanitizeLPSectionProps(props: any): any {
  if (typeof props === 'string') return sanitizeLPCopy(props);
  if (Array.isArray(props)) return props.map(sanitizeLPSectionProps);
  if (props && typeof props === 'object') {
    const result: any = {};
    for (const [key, val] of Object.entries(props)) {
      // Skip URLs and numeric/boolean fields
      if (key.toLowerCase().includes('url') || key === 'price' || key === 'compareAtPrice' || 
          key === 'discountPercent' || key === 'rating' || key === 'isFeatured' ||
          typeof val === 'number' || typeof val === 'boolean') {
        result[key] = val;
      } else {
        result[key] = sanitizeLPSectionProps(val);
      }
    }
    return result;
  }
  return props;
}