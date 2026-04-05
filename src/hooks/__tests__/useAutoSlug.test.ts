import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSlug } from '../useAutoSlug';

describe('useAutoSlug', () => {
  it('auto-generates slug from name in create mode', () => {
    const { result } = renderHook(() => useAutoSlug());

    act(() => {
      result.current.handleNameChange('Camiseta Básica');
    });

    expect(result.current.slug).toBe('camiseta-basica');
    expect(result.current.isAutoGenerating).toBe(true);
  });

  it('stops auto-generating after manual edit', () => {
    const { result } = renderHook(() => useAutoSlug());

    act(() => {
      result.current.handleNameChange('Test Product');
    });
    expect(result.current.slug).toBe('test-product');

    act(() => {
      result.current.setSlug('custom-slug');
    });
    expect(result.current.slug).toBe('custom-slug');
    expect(result.current.isAutoGenerating).toBe(false);

    // Further name changes should NOT update slug
    act(() => {
      result.current.handleNameChange('New Name');
    });
    expect(result.current.slug).toBe('custom-slug');
  });

  it('does not auto-generate in edit mode', () => {
    const { result } = renderHook(() =>
      useAutoSlug({ initialSlug: 'existing-slug', isEditing: true })
    );

    expect(result.current.slug).toBe('existing-slug');
    expect(result.current.isAutoGenerating).toBe(false);

    act(() => {
      result.current.handleNameChange('New Name');
    });
    expect(result.current.slug).toBe('existing-slug');
  });

  it('resets auto-generation', () => {
    const { result } = renderHook(() => useAutoSlug());

    act(() => {
      result.current.setSlug('manual');
    });
    expect(result.current.isAutoGenerating).toBe(false);

    act(() => {
      result.current.resetAutoGeneration();
    });
    expect(result.current.isAutoGenerating).toBe(true);
    expect(result.current.slug).toBe('');

    act(() => {
      result.current.handleNameChange('After Reset');
    });
    expect(result.current.slug).toBe('after-reset');
  });

  it('handles accented characters correctly', () => {
    const { result } = renderHook(() => useAutoSlug());

    act(() => {
      result.current.handleNameChange('Promoção de Verão');
    });
    expect(result.current.slug).toBe('promocao-de-verao');
  });

  it('handles special characters', () => {
    const { result } = renderHook(() => useAutoSlug());

    act(() => {
      result.current.handleNameChange('Product @#$% Test!');
    });
    expect(result.current.slug).toBe('product-test');
  });
});
