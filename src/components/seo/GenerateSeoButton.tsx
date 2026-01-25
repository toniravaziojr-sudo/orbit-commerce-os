// =============================================
// GENERATE SEO BUTTON - AI-powered SEO generation
// Reusable component for generating SEO title and description
// =============================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SeoInput {
  type: 'product' | 'category' | 'blog' | 'page';
  name: string;
  description?: string;
  content?: string;
  excerpt?: string;
  tags?: string[];
  imageUrl?: string;
  price?: number;
  storeName?: string;
}

export interface SeoResult {
  seo_title: string;
  seo_description: string;
}

interface GenerateSeoButtonProps {
  input: SeoInput;
  onGenerated: (result: SeoResult) => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function GenerateSeoButton({
  input,
  onGenerated,
  disabled = false,
  className = '',
  variant = 'outline',
  size = 'sm',
}: GenerateSeoButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!input.name?.trim()) {
      toast.error('Preencha o nome/título antes de gerar o SEO');
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-seo', {
        body: input,
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      onGenerated({
        seo_title: data.seo_title || '',
        seo_description: data.seo_description || '',
      });

      toast.success('SEO gerado com sucesso!');
    } catch (error: any) {
      console.error('Error generating SEO:', error);
      
      if (error.message?.includes('429') || error.message?.includes('limite')) {
        toast.error('Limite de requisições excedido. Aguarde alguns segundos.');
      } else if (error.message?.includes('402') || error.message?.includes('créditos')) {
        toast.error('Créditos de IA esgotados. Adicione créditos ao workspace.');
      } else {
        toast.error('Erro ao gerar SEO. Tente novamente.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleGenerate}
      disabled={disabled || isGenerating || !input.name?.trim()}
      className={className}
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Gerando...
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4 mr-2" />
          Gerar SEO com IA
        </>
      )}
    </Button>
  );
}

export default GenerateSeoButton;
