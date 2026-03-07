// =============================================
// BLOCK COMPILER — Shared Utilities
// =============================================

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function optimizeImageUrl(url: string | undefined | null, width: number, quality = 80): string {
  if (!url) return '';
  if (url.startsWith('https://wsrv.nl') || url.startsWith('data:')) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&q=${quality}&output=webp`;
}

export function formatPriceFromDecimal(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}
