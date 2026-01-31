/**
 * Hook para buscar Voice Presets do banco
 * 
 * Os presets precisam ter ref_audio_url preenchido para funcionar com F5-TTS
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VoicePreset {
  id: string;
  slug: string;
  name: string;
  category: 'female' | 'male' | 'neutral';
  language: string;
  ref_audio_url: string | null;
  ref_text: string | null;
  description: string | null;
  is_active: boolean;
}

export function useVoicePresets() {
  return useQuery({
    queryKey: ['voice-presets'],
    queryFn: async (): Promise<VoicePreset[]> => {
      const { data, error } = await supabase
        .from('voice_presets')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching voice presets:', error);
        return [];
      }

      return (data || []) as VoicePreset[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

/**
 * Filtra presets disponíveis (com ref_audio_url configurado)
 */
export function useAvailableVoicePresets() {
  const { data: presets, ...rest } = useVoicePresets();
  
  return {
    ...rest,
    data: presets?.filter(p => p.ref_audio_url) || [],
    allPresets: presets || [],
  };
}
