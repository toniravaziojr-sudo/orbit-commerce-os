/**
 * Voice Preset Audio — Edge Function
 * 
 * Gera URLs assinadas para preview de áudios dos voice presets.
 * Os áudios estão em bucket privado (system-voice-presets) para
 * impedir download direto.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { preset_id } = await req.json();

    if (!preset_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'preset_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar preset
    const { data: preset, error: presetError } = await supabase
      .from('voice_presets')
      .select('ref_audio_url, name, is_active')
      .eq('id', preset_id)
      .single();

    if (presetError || !preset) {
      return new Response(
        JSON.stringify({ success: false, error: 'Preset not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!preset.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Preset is not active' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!preset.ref_audio_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Preset has no audio' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair path do bucket da URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/system-voice-presets/filename.ogg
    const urlParts = preset.ref_audio_url.split('/system-voice-presets/');
    if (urlParts.length < 2) {
      console.error('[voice-preset-audio] Invalid URL format:', preset.ref_audio_url);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid audio URL format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const filePath = urlParts[1];
    console.log('[voice-preset-audio] Generating signed URL for:', filePath);

    // Gerar URL assinada (válida por 5 minutos)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('system-voice-presets')
      .createSignedUrl(filePath, 300); // 5 minutos

    if (signedError || !signedData?.signedUrl) {
      console.error('[voice-preset-audio] Error creating signed URL:', signedError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate audio URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[voice-preset-audio] Signed URL generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        signed_url: signedData.signedUrl,
        expires_in: 300,
        name: preset.name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[voice-preset-audio] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
