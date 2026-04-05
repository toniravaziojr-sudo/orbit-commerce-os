import { describe, it, expect } from 'vitest';
import {
  generateSlug,
  validateSlugFormat,
  normalizeSlug,
  hasValidSlug,
  isReservedSlug,
  RESERVED_SLUGS,
} from '../slugPolicy';

describe('generateSlug', () => {
  it('converts basic text to slug', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('removes accents (NFD normalization)', () => {
    expect(generateSlug('Café com Leite')).toBe('cafe-com-leite');
    expect(generateSlug('São Paulo')).toBe('sao-paulo');
    expect(generateSlug('Ação Promoção')).toBe('acao-promocao');
  });

  it('removes special characters', () => {
    expect(generateSlug('Product @#$% Test!')).toBe('product-test');
  });

  it('collapses multiple hyphens', () => {
    expect(generateSlug('a---b')).toBe('a-b');
    expect(generateSlug('hello   world')).toBe('hello-world');
  });

  it('removes leading/trailing hyphens', () => {
    expect(generateSlug('-hello-')).toBe('hello');
    expect(generateSlug('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('');
  });

  it('handles full sentence with accents', () => {
    expect(generateSlug('Camiseta Básica Masculina')).toBe('camiseta-basica-masculina');
  });

  it('handles numbers', () => {
    expect(generateSlug('Product 123')).toBe('product-123');
  });
});

describe('validateSlugFormat', () => {
  it('accepts valid slugs', () => {
    expect(validateSlugFormat('hello-world').isValid).toBe(true);
    expect(validateSlugFormat('product-123').isValid).toBe(true);
    expect(validateSlugFormat('a').isValid).toBe(true);
  });

  it('rejects empty/null/undefined', () => {
    expect(validateSlugFormat('').isValid).toBe(false);
    expect(validateSlugFormat(null).isValid).toBe(false);
    expect(validateSlugFormat(undefined).isValid).toBe(false);
  });

  it('rejects uppercase', () => {
    const result = validateSlugFormat('Hello');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('minúsculas');
  });

  it('rejects spaces', () => {
    const result = validateSlugFormat('hello world');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('espaços');
  });

  it('rejects leading/trailing hyphens', () => {
    expect(validateSlugFormat('-hello').isValid).toBe(false);
    expect(validateSlugFormat('hello-').isValid).toBe(false);
  });

  it('rejects reserved slugs', () => {
    for (const reserved of RESERVED_SLUGS) {
      expect(validateSlugFormat(reserved).isValid).toBe(false);
    }
  });

  it('rejects slugs over 200 chars', () => {
    const long = 'a'.repeat(201);
    expect(validateSlugFormat(long).isValid).toBe(false);
  });
});

describe('normalizeSlug', () => {
  it('lowercases and trims', () => {
    expect(normalizeSlug(' Hello ')).toBe('hello');
  });
});

describe('hasValidSlug', () => {
  it('returns true for valid slug', () => {
    expect(hasValidSlug('valid-slug')).toBe(true);
  });
  it('returns false for null/undefined/empty', () => {
    expect(hasValidSlug(null)).toBe(false);
    expect(hasValidSlug(undefined)).toBe(false);
    expect(hasValidSlug('')).toBe(false);
  });
});

describe('isReservedSlug', () => {
  it('detects reserved slugs', () => {
    expect(isReservedSlug('admin')).toBe(true);
    expect(isReservedSlug('checkout')).toBe(true);
  });
  it('allows non-reserved', () => {
    expect(isReservedSlug('my-product')).toBe(false);
  });
});
