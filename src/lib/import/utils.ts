// =============================================
// UTILITÁRIOS COMPARTILHADOS PARA IMPORTAÇÃO
// =============================================

/**
 * Strip HTML tags and convert to plain text
 * Preserves line breaks and text structure
 */
export function stripHtmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  
  return html
    // Replace <br>, <br/>, </p>, </div>, </li> with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<h[1-6][^>]*>/gi, '')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '\"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Clean up excessive whitespace and newlines
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .trim() || null;
}

/**
 * Extract only numeric characters from a string (for SKU, GTIN, barcode)
 */
export function extractNumericOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\\d]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Clean SKU - remove special chars like quotes
 */
export function cleanSku(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/['"]/g, '').trim() || null;
}

/**
 * Create a URL-friendly slug from text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Parse Brazilian price format (R$ 49,90 or 49.90)
 */
export function parseBrazilianPrice(price: string | number | null | undefined): number {
  if (price === null || price === undefined) return 0;
  if (typeof price === 'number') return price;
  
  // Remove currency symbol and spaces
  const cleaned = price.replace(/[R$\s]/g, '');
  
  // Handle Brazilian format (1.234,56) vs American format (1,234.56)
  // If has comma followed by 2 digits at end, it's Brazilian
  if (/,\\d{2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }
  
  // Otherwise assume standard format
  return parseFloat(cleaned.replace(',', '')) || 0;
}

/**
 * Normalize phone number - extract only digits
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits;
}

/**
 * Normalize CPF/CNPJ - extract only digits and validate length
 */
export function normalizeCpfCnpj(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 && digits.length !== 14) return null;
  return digits;
}

/**
 * Normalize gender to standard format
 */
export function normalizeGender(gender: string | null | undefined): 'male' | 'female' | null {
  if (!gender) return null;
  const g = gender.toLowerCase();
  if (g === 'm' || g === 'masculino' || g === 'male') return 'male';
  if (g === 'f' || g === 'feminino' || g === 'female') return 'female';
  return null;
}

/**
 * Parse a CSV line handling quoted fields that may contain commas
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === ';') && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Push last field
  result.push(current.trim());
  
  return result;
}

/**
 * Parse CSV content into array of objects
 */
export function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  const data: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''));
    if (values.length === headers.length || values.some(v => v.trim())) {
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      data.push(row);
    }
  }
  
  return data;
}
