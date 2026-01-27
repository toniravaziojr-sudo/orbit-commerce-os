/**
 * Gestão de Criativos — Tipos e Interfaces
 * 
 * Módulo para geração de criativos com IA (vídeos e imagens)
 * 6 abas: UGC Cliente, UGC 100% IA, Vídeos Curtos, Vídeos Tech, Imagens Produto, Avatar Mascote
 */

// === Status de Jobs ===
export type CreativeJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

// === Tipos de Criativos (Abas) ===
export type CreativeType = 
  | 'ugc_client_video'       // Aba 1: UGC Cliente gravou vídeo
  | 'ugc_ai_video'           // Aba 2: UGC 100% IA
  | 'short_video'            // Aba 3: Vídeos curtos (pessoa falando)
  | 'tech_product_video'     // Aba 4: Vídeos tecnológicos de produtos
  | 'product_image'          // Aba 5: Imagens de pessoas segurando produto
  | 'avatar_mascot';         // Aba 6: Avatar/Mascote animado (tipo Magalu)

// === Aspect Ratios ===
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

// === Durações de Vídeo ===
export type VideoDuration = 5 | 10 | 15 | 20 | 25 | 30 | 60;

// === Modelos de IA ===
export interface AIModelConfig {
  id: string;
  name: string;
  provider: 'fal' | 'openai';
  endpoint: string;
  description: string;
  isDefault?: boolean;
  fallbackModel?: string;
  costEstimate?: number; // em centavos
}

// === Configuração de Modelos por Tipo de Criativo ===
export const CREATIVE_MODELS: Record<CreativeType, AIModelConfig[]> = {
  ugc_client_video: [
    {
      id: 'pixverse-swap-person',
      name: 'PixVerse Swap (Pessoa)',
      provider: 'fal',
      endpoint: 'fal-ai/pixverse/swap',
      description: 'Trocar pessoa/rosto mantendo vídeo base',
      isDefault: true,
      costEstimate: 50,
    },
    {
      id: 'pixverse-swap-bg',
      name: 'PixVerse Swap (Fundo)',
      provider: 'fal',
      endpoint: 'fal-ai/pixverse/swap',
      description: 'Trocar fundo do vídeo',
      costEstimate: 30,
    },
    {
      id: 'chatterbox-voice',
      name: 'ChatterboxHD (Voz)',
      provider: 'fal',
      endpoint: 'resemble-ai/chatterboxhd/speech-to-speech',
      description: 'Conversão de voz para voz',
      costEstimate: 20,
    },
    {
      id: 'sync-lipsync',
      name: 'Sync LipSync v2 Pro',
      provider: 'fal',
      endpoint: 'fal-ai/sync-lipsync/v2/pro',
      description: 'Sincronização labial com novo áudio',
      costEstimate: 40,
    },
  ],
  ugc_ai_video: [
    {
      id: 'kling-avatar',
      name: 'Kling AI Avatar v2 Pro',
      provider: 'fal',
      endpoint: 'fal-ai/kling-video/ai-avatar/v2/pro',
      description: 'Avatar IA realista falando (UGC-style)',
      isDefault: true,
      costEstimate: 80,
    },
    {
      id: 'veo31-text-video',
      name: 'Veo 3.1 Text-to-Video',
      provider: 'fal',
      endpoint: 'fal-ai/veo3.1',
      description: 'Vídeo gerado 100% por texto (full video)',
      costEstimate: 100,
    },
    {
      id: 'sora2-text-video',
      name: 'Sora 2 Text-to-Video Pro',
      provider: 'fal',
      endpoint: 'fal-ai/sora-2/text-to-video/pro',
      description: 'Vídeo premium gerado por texto',
      costEstimate: 120,
    },
  ],
  short_video: [
    {
      id: 'kling-avatar-short',
      name: 'Kling AI Avatar v2 Pro',
      provider: 'fal',
      endpoint: 'fal-ai/kling-video/ai-avatar/v2/pro',
      description: 'Avatar falando (talking head) — máxima naturalidade',
      isDefault: true,
      costEstimate: 80,
    },
    {
      id: 'sync-lipsync-final',
      name: 'Sync LipSync v2 Pro (Pós)',
      provider: 'fal',
      endpoint: 'fal-ai/sync-lipsync/v2/pro',
      description: 'Sincronização labial final (se necessário)',
      costEstimate: 40,
    },
  ],
  tech_product_video: [
    {
      id: 'veo31-first-last',
      name: 'Veo 3.1 First/Last Frame',
      provider: 'fal',
      endpoint: 'fal-ai/veo3.1/first-last-frame-to-video',
      description: 'Vídeo premium com controle de frames inicial/final',
      isDefault: true,
      costEstimate: 100,
    },
    {
      id: 'veo31-image-video',
      name: 'Veo 3.1 Image-to-Video',
      provider: 'fal',
      endpoint: 'fal-ai/veo3.1/image-to-video',
      description: 'Vídeo a partir de imagem do produto',
      costEstimate: 80,
    },
    {
      id: 'sora2-image-video',
      name: 'Sora 2 Image-to-Video Pro',
      provider: 'fal',
      endpoint: 'fal-ai/sora-2/image-to-video/pro',
      description: 'Vídeo cinematográfico premium',
      costEstimate: 120,
    },
  ],
  product_image: [
    {
      id: 'gpt-image-edit',
      name: 'GPT Image 1.5 Edit',
      provider: 'openai',
      endpoint: 'gpt-image-1.5/edit',
      description: 'Pessoas realistas segurando o produto (fidelidade máxima)',
      isDefault: true,
      costEstimate: 2,
    },
  ],
  avatar_mascot: [
    {
      id: 'kling-avatar-mascot-pro',
      name: 'Kling AI Avatar v2 Pro',
      provider: 'fal',
      endpoint: 'fal-ai/kling-video/ai-avatar/v2/pro',
      description: 'Avatar/mascote animado falando (talking head) — máxima qualidade',
      isDefault: true,
      costEstimate: 80,
      fallbackModel: 'kling-avatar-mascot-std',
    },
    {
      id: 'kling-avatar-mascot-std',
      name: 'Kling AI Avatar v2 Standard',
      provider: 'fal',
      endpoint: 'fal-ai/kling-video/ai-avatar/v2/standard',
      description: 'Avatar/mascote (fallback econômico)',
      costEstimate: 40,
    },
    {
      id: 'f5-tts',
      name: 'F5 TTS (Text-to-Speech)',
      provider: 'fal',
      endpoint: 'fal-ai/f5-tts',
      description: 'Geração de voz a partir de texto com clonagem',
      costEstimate: 10,
    },
    {
      id: 'chatterbox-s2s-mascot',
      name: 'ChatterboxHD S2S',
      provider: 'fal',
      endpoint: 'resemble-ai/chatterboxhd/speech-to-speech',
      description: 'Conversão de voz (se enviar áudio base)',
      costEstimate: 20,
    },
    {
      id: 'sync-lipsync-mascot',
      name: 'Sync LipSync v2 Pro',
      provider: 'fal',
      endpoint: 'fal-ai/sync-lipsync/v2/pro',
      description: 'Pós-processo de sincronização labial',
      costEstimate: 40,
    },
  ],
};

// === Presets por Tipo ===
export interface CreativePreset {
  id: string;
  name: string;
  description: string;
  type: CreativeType;
  settings: Record<string, unknown>;
}

export const DEFAULT_PRESETS: CreativePreset[] = [
  // UGC Client
  { id: 'ugc-bathroom', name: 'UGC Banheiro', description: 'Cliente no banheiro mostrando produto', type: 'ugc_client_video', settings: { scene: 'bathroom' } },
  { id: 'ugc-bedroom', name: 'UGC Quarto', description: 'Cliente no quarto, luz natural', type: 'ugc_client_video', settings: { scene: 'bedroom' } },
  
  // UGC AI
  { id: 'ugc-ai-testimonial', name: 'Depoimento IA', description: 'Avatar IA dando depoimento', type: 'ugc_ai_video', settings: { style: 'testimonial' } },
  { id: 'ugc-ai-unboxing', name: 'Unboxing IA', description: 'Avatar IA fazendo unboxing', type: 'ugc_ai_video', settings: { style: 'unboxing' } },
  
  // Vídeos Curtos
  { id: 'short-review', name: 'Review Rápido', description: 'Review de 15-30s', type: 'short_video', settings: { duration: 20, tone: 'review' } },
  { id: 'short-educational', name: 'Educativo', description: 'Vídeo explicativo curto', type: 'short_video', settings: { duration: 30, tone: 'educational' } },
  
  // Vídeos Tech
  { id: 'tech-premium-black', name: 'Tech Premium Black', description: 'Fundo escuro, reflexos premium', type: 'tech_product_video', settings: { style: 'dark-premium' } },
  { id: 'tech-clean-studio', name: 'Clean Studio', description: 'Estúdio branco minimalista', type: 'tech_product_video', settings: { style: 'clean-studio' } },
  { id: 'tech-futuristic', name: 'Futurista', description: 'Efeitos tech, partículas', type: 'tech_product_video', settings: { style: 'futuristic' } },
  
  // Imagens Produto
  { id: 'image-bathroom', name: 'Pessoa no Banheiro', description: 'Segurando produto no banheiro', type: 'product_image', settings: { scene: 'bathroom' } },
  { id: 'image-gym', name: 'Pessoa na Academia', description: 'Segurando produto na academia', type: 'product_image', settings: { scene: 'gym' } },
  { id: 'image-outdoor', name: 'Pessoa ao Ar Livre', description: 'Luz natural externa', type: 'product_image', settings: { scene: 'outdoor' } },
  
  // Avatar Mascote
  { id: 'mascot-corporate', name: 'Mascote Corporativo', description: 'Avatar falando sobre produto/marca', type: 'avatar_mascot', settings: { style: 'corporate' } },
  { id: 'mascot-friendly', name: 'Mascote Amigável', description: 'Tom mais casual e próximo', type: 'avatar_mascot', settings: { style: 'friendly' } },
  { id: 'mascot-expert', name: 'Mascote Especialista', description: 'Tom educativo/tutorial', type: 'avatar_mascot', settings: { style: 'expert' } },
];

// === Job de Geração ===
export interface CreativeJob {
  id: string;
  tenant_id: string;
  type: CreativeType;
  status: CreativeJobStatus;
  
  // Inputs
  prompt: string;
  product_id?: string;
  product_name?: string;
  product_image_url?: string;
  reference_images?: string[];
  reference_video_url?: string;
  reference_audio_url?: string;
  
  // Settings
  settings: {
    aspect_ratio?: AspectRatio;
    duration?: VideoDuration;
    model_id?: string;
    preset_id?: string;
    swap_person?: boolean;
    swap_background?: boolean;
    swap_voice?: boolean;
    quality?: 'standard' | 'high';
    variations?: number;
    [key: string]: unknown;
  };
  
  // Compliance
  has_authorization?: boolean;
  authorization_accepted_at?: string;
  
  // Pipeline
  pipeline_steps?: PipelineStep[];
  current_step?: number;
  
  // Output
  output_urls?: string[];
  output_folder_id?: string;
  
  // Metadata
  error_message?: string;
  cost_cents?: number;
  processing_time_ms?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  created_by: string;
}

export interface PipelineStep {
  step_id: string;
  model_id: string;
  status: CreativeJobStatus;
  input_url?: string;
  output_url?: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

// === Formulários por Aba ===
export interface UGCClientVideoForm {
  base_video: File | null;
  reference_images: File[];
  swap_person: boolean;
  swap_background: boolean;
  swap_voice: boolean;
  background_reference?: File | null;
  background_prompt?: string;
  voice_reference?: File | null;
  voice_preset?: string;
  aspect_ratio: AspectRatio;
  has_authorization: boolean;
}

export interface UGCAIVideoForm {
  mode: 'avatar' | 'full_video';
  script: string;
  cta?: string;
  avatar_reference?: File | null;
  voice_preset: string;
  aspect_ratio: AspectRatio;
  duration: VideoDuration;
}

export interface ShortVideoForm {
  topic: string;
  bullets: string[];
  tone: 'direct' | 'seller' | 'educational' | 'casual';
  script: string;
  avatar_preset: string;
  avatar_reference?: File | null;
  voice_preset: string;
  generate_variations: boolean;
  variation_count: number;
  has_authorization: boolean;
}

export interface TechProductVideoForm {
  product_id: string;
  product_images: File[];
  style: 'dark-premium' | 'clean-studio' | 'futuristic' | 'minimalist';
  aspect_ratio: AspectRatio;
  duration: VideoDuration;
  first_frame?: File | null;
  last_frame?: File | null;
  prompt_additions?: string;
}

export interface ProductImageForm {
  product_id: string;
  scene: 'bathroom' | 'bedroom' | 'gym' | 'outdoor' | 'office' | 'kitchen';
  gender: 'male' | 'female' | 'any';
  age_range: 'young' | 'middle' | 'mature';
  pose: 'holding' | 'using' | 'displaying';
  variations: number;
  brief?: string;
}

// === Formulário Avatar Mascote ===
export interface AvatarMascotForm {
  avatar_image: File | null;
  avatar_style: 'cartoon' | '3d' | 'realistic' | 'anime';
  script: string;
  voice_source: 'tts' | 'upload' | 'reference';
  voice_text?: string; // para TTS
  voice_audio?: File | null; // para upload ou referência
  voice_preset: string;
  tone: 'corporate' | 'friendly' | 'expert' | 'casual' | 'energetic';
  aspect_ratio: AspectRatio;
  duration: VideoDuration;
  apply_lipsync_post: boolean;
}

// === Pasta de Criativos ===
export const CREATIVES_FOLDER_NAME = 'Criativos com IA';

// === Limites por Plano ===
export interface PlanLimits {
  monthly_jobs: number;
  max_duration_seconds: number;
  max_variations: number;
  allowed_types: CreativeType[];
}
