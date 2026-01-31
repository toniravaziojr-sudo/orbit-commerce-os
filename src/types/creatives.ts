/**
 * Gestão de Criativos — Tipos e Interfaces
 * 
 * Módulo para geração de criativos com IA (vídeos e imagens)
 * 5 abas: UGC Real, UGC 100% IA, Vídeos de Produto, Imagens com Produto, Avatar Mascote
 * 
 * IMPORTANTE: Alinhado com schemas reais da Fal.ai
 * - PixVerse: NÃO aceita texto para fundo, apenas image_url
 * - Kling I2V: usa start_image_url (não image_url)
 * - GPT Image: sizes 1024x1024|1024x1536|1536x1024, quality low|medium|high
 * - F5-TTS: exige ref_audio_url para presets
 * - Veo 3.1: prompt-only, NÃO usar para vídeos de produto com fidelidade
 */

// === Status de Jobs ===
export type CreativeJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

// === Tipos de Criativos (5 Abas) ===
export type CreativeType = 
  | 'ugc_client_video'       // Aba 1: UGC Real (cliente gravou vídeo)
  | 'ugc_ai_video'           // Aba 2: UGC 100% IA (com produto do catálogo)
  | 'product_video'          // Aba 3: Vídeos de Produto SEM pessoas (substitui short_video + tech_product_video)
  | 'product_image'          // Aba 4: Imagens de pessoas + cenário + produto
  | 'avatar_mascot';         // Aba 5: Avatar/Mascote animado (tipo Magalu)

// Tipos deprecated (mantidos para compatibilidade com jobs antigos)
export type DeprecatedCreativeType = 'short_video' | 'tech_product_video';

// === Aspect Ratios ===
export type AspectRatio = '16:9' | '9:16' | '1:1';

// === Durações de Vídeo (Kling I2V) ===
export type KlingVideoDuration = '5' | '10'; // String conforme schema

// === Durações de Vídeo (Avatar/outros) ===
export type VideoDuration = 5 | 10 | 15 | 20 | 25 | 30;

// === GPT Image Settings (conforme schema real) ===
export type GPTImageSize = '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
export type GPTImageQuality = 'low' | 'medium' | 'high';
export type GPTImageBackground = 'auto' | 'opaque' | 'transparent';
export type GPTImageFidelity = 'low' | 'medium' | 'high';

// === Modelos de IA ===
export interface AIModelConfig {
  id: string;
  name: string;
  provider: 'fal' | 'openai' | 'lovable';
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
      description: 'Trocar pessoa/rosto mantendo vídeo base (mode=person)',
      isDefault: true,
      costEstimate: 50,
    },
    {
      id: 'pixverse-swap-bg',
      name: 'PixVerse Swap (Fundo)',
      provider: 'fal',
      endpoint: 'fal-ai/pixverse/swap',
      description: 'Trocar fundo do vídeo (mode=background) — EXIGE image_url, não aceita texto',
      costEstimate: 30,
    },
    {
      id: 'f5-tts',
      name: 'F5-TTS (Text-to-Speech)',
      provider: 'fal',
      endpoint: 'fal-ai/f5-tts',
      description: 'Gerar voz a partir de texto + referência de voz (gen_text + ref_audio_url)',
      costEstimate: 10,
    },
    {
      id: 'sync-lipsync',
      name: 'Sync LipSync v2 Pro',
      provider: 'fal',
      endpoint: 'fal-ai/sync-lipsync/v2/pro',
      description: 'Sincronização labial com áudio gerado (video_url + audio_url)',
      costEstimate: 40,
    },
    {
      id: 'gpt-image-bg',
      name: 'GPT Image 1.5 Edit (Gerar Fundo)',
      provider: 'lovable',
      endpoint: 'gpt-image-1.5/edit',
      description: 'Gerar imagem de fundo a partir de descrição (para PixVerse)',
      costEstimate: 2,
    },
  ],
  ugc_ai_video: [
    {
      id: 'kling-avatar-pro',
      name: 'Kling AI Avatar v2 Pro',
      provider: 'fal',
      endpoint: 'fal-ai/kling-video/ai-avatar/v2/pro',
      description: 'Avatar IA realista falando (image_url + audio_url) — modo Talking Head',
      isDefault: true,
      costEstimate: 80,
    },
    {
      id: 'gpt-image-keyframe',
      name: 'GPT Image 1.5 Edit (Keyframe)',
      provider: 'lovable',
      endpoint: 'gpt-image-1.5/edit',
      description: 'Gerar keyframe com pessoa + produto (input_fidelity alto)',
      costEstimate: 2,
    },
    {
      id: 'kling-i2v-pro',
      name: 'Kling I2V v2.6 Pro',
      provider: 'fal',
      endpoint: 'fal-ai/kling-video/v2.6/pro/image-to-video',
      description: 'Animar keyframe (start_image_url) — modo Em Cena com Produto',
      costEstimate: 60,
    },
    {
      id: 'f5-tts',
      name: 'F5-TTS (Voiceover)',
      provider: 'fal',
      endpoint: 'fal-ai/f5-tts',
      description: 'Gerar narração/voiceover (gen_text + ref_audio_url)',
      costEstimate: 10,
    },
  ],
  product_video: [
    // Nova aba unificada — substitui short_video + tech_product_video
    {
      id: 'kling-i2v-pro',
      name: 'Kling I2V v2.6 Pro',
      provider: 'fal',
      endpoint: 'fal-ai/kling-video/v2.6/pro/image-to-video',
      description: 'Animar imagem de produto (start_image_url + end_image_url opcional) — fidelidade máxima',
      isDefault: true,
      costEstimate: 60,
    },
    {
      id: 'gpt-image-scene',
      name: 'GPT Image 1.5 Edit (Cenário Premium)',
      provider: 'lovable',
      endpoint: 'gpt-image-1.5/edit',
      description: 'Gerar cenário premium para produto (iluminação, fundo)',
      costEstimate: 2,
    },
  ],
  product_image: [
    {
      id: 'gpt-image-edit',
      name: 'GPT Image 1.5 Edit',
      provider: 'lovable',
      endpoint: 'gpt-image-1.5/edit',
      description: 'Pessoas realistas segurando o produto (input_fidelity para preservar rótulo)',
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
      description: 'Avatar/mascote animado falando (image_url + audio_url) — máxima qualidade',
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
      name: 'F5-TTS (Text-to-Speech)',
      provider: 'fal',
      endpoint: 'fal-ai/f5-tts',
      description: 'Gerar voz a partir de texto + referência (gen_text + ref_audio_url)',
      costEstimate: 10,
    },
    {
      id: 'sync-lipsync-mascot',
      name: 'Sync LipSync v2 Pro',
      provider: 'fal',
      endpoint: 'fal-ai/sync-lipsync/v2/pro',
      description: 'Pós-processo de sincronização labial (opcional)',
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
  // UGC Client (Real)
  { id: 'ugc-bathroom', name: 'UGC Banheiro', description: 'Cliente no banheiro mostrando produto', type: 'ugc_client_video', settings: { scene: 'bathroom' } },
  { id: 'ugc-bedroom', name: 'UGC Quarto', description: 'Cliente no quarto, luz natural', type: 'ugc_client_video', settings: { scene: 'bedroom' } },
  
  // UGC AI (com produto)
  { id: 'ugc-ai-testimonial', name: 'Depoimento IA', description: 'Avatar IA dando depoimento sobre produto', type: 'ugc_ai_video', settings: { style: 'testimonial', mode: 'talking_head' } },
  { id: 'ugc-ai-unboxing', name: 'Unboxing IA', description: 'Pessoa em cena fazendo unboxing', type: 'ugc_ai_video', settings: { style: 'unboxing', mode: 'scene_with_product' } },
  
  // Vídeos de Produto (sem pessoas)
  { id: 'product-rotation', name: 'Rotação Suave', description: 'Produto girando lentamente', type: 'product_video', settings: { style: 'rotation', motion: 'slow' } },
  { id: 'product-floating', name: 'Flutuando', description: 'Levitação + partículas', type: 'product_video', settings: { style: 'floating', effects: 'particles' } },
  { id: 'product-splash', name: 'Splash Líquido', description: 'Gel, água, splash', type: 'product_video', settings: { style: 'splash' } },
  { id: 'product-macro', name: 'Macro Close-up', description: 'Foco em detalhes', type: 'product_video', settings: { style: 'macro' } },
  { id: 'product-tech-black', name: 'Tech Premium Black', description: 'Fundo escuro + reflexos', type: 'product_video', settings: { style: 'tech-premium-black' } },
  { id: 'product-clean-studio', name: 'Clean Studio', description: 'Fundo branco minimalista', type: 'product_video', settings: { style: 'clean-studio' } },
  
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
  type: CreativeType | DeprecatedCreativeType;
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
  settings: CreativeJobSettings;
  
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

export interface CreativeJobSettings {
  aspect_ratio?: AspectRatio;
  duration?: VideoDuration | KlingVideoDuration;
  model_id?: string;
  preset_id?: string;
  
  // UGC Real
  swap_person?: boolean;
  swap_background?: boolean;
  swap_voice?: boolean;
  background_mode?: 'upload' | 'generate'; // upload imagem OU gerar por IA
  background_prompt?: string; // só para generate
  background_reference?: string; // URL da imagem de fundo
  voice_mode?: 'keep' | 'tts' | 'clone'; // manter original, TTS preset, clonar
  voice_script?: string; // texto que será falado
  voice_preset_id?: string; // ID do preset de voz (com ref_audio_url interno)
  voice_reference?: string; // URL do áudio de referência para clonagem
  
  // UGC 100% IA
  mode?: 'talking_head' | 'scene_with_product';
  apply_lipsync?: boolean;
  
  // Vídeos de Produto
  style?: string;
  motion_intensity?: 'low' | 'medium' | 'high';
  start_frame?: string; // URL do frame inicial (start_image_url)
  end_frame?: string; // URL do frame final (end_image_url) - opcional
  generate_premium_scene?: boolean;
  
  // Imagens de Produto (GPT Image corrigido)
  size?: GPTImageSize;
  quality?: GPTImageQuality;
  background?: GPTImageBackground;
  input_fidelity?: GPTImageFidelity;
  variations?: number;
  
  [key: string]: unknown;
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
  // Fundo
  background_mode: 'upload' | 'generate';
  background_reference?: File | null;
  background_prompt?: string;
  // Voz
  voice_mode: 'keep' | 'tts' | 'clone';
  voice_script?: string;
  voice_preset_id?: string;
  voice_reference?: File | null;
  // Geral
  aspect_ratio: AspectRatio;
  has_authorization: boolean;
}

export interface UGCAIVideoForm {
  product_id: string; // OBRIGATÓRIO
  product_image_url?: string;
  mode: 'talking_head' | 'scene_with_product';
  script: string;
  cta?: string;
  avatar_reference?: File | null;
  voice_preset_id: string;
  aspect_ratio: AspectRatio;
  duration: VideoDuration;
  apply_lipsync?: boolean;
}

export interface ProductVideoForm {
  product_id: string; // OBRIGATÓRIO
  product_image_url: string;
  product_images?: File[];
  style: 'rotation' | 'floating' | 'splash' | 'macro' | 'tech-premium-black' | 'clean-studio';
  start_frame?: File | null;
  end_frame?: File | null;
  duration: KlingVideoDuration;
  aspect_ratio: AspectRatio;
  prompt_additions?: string;
  generate_premium_scene?: boolean;
}

export interface ProductImageForm {
  product_id: string; // OBRIGATÓRIO
  product_image_url: string;
  scene: 'bathroom' | 'bedroom' | 'gym' | 'outdoor' | 'office' | 'kitchen';
  gender: 'male' | 'female' | 'any';
  age_range: 'young' | 'middle' | 'mature';
  pose: 'holding' | 'using' | 'displaying';
  // Campos corrigidos conforme schema GPT Image
  size: GPTImageSize;
  quality: GPTImageQuality;
  background: GPTImageBackground;
  input_fidelity: GPTImageFidelity;
  variations: number;
  brief?: string;
}

// === Formulário Avatar Mascote ===
export interface AvatarMascotForm {
  avatar_image: File | null;
  avatar_style: 'cartoon' | '3d' | 'realistic' | 'anime';
  script: string;
  voice_source: 'tts' | 'upload' | 'clone';
  voice_text?: string; // para TTS
  voice_audio?: File | null; // para upload ou referência
  voice_preset_id: string; // Preset com ref_audio_url interno
  tone: 'corporate' | 'friendly' | 'expert' | 'casual' | 'energetic';
  aspect_ratio: AspectRatio;
  duration: VideoDuration;
  apply_lipsync_post: boolean;
}

// === Presets de Voz (F5-TTS precisa ref_audio_url) ===
export interface VoicePreset {
  id: string;
  slug: string;
  name: string;
  category: 'female' | 'male' | 'neutral';
  language: string;
  ref_audio_url: string; // OBRIGATÓRIO para F5-TTS
  ref_text?: string; // Transcrição do áudio de referência
  description?: string;
  is_active: boolean;
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

// === Estilos visuais para Vídeos de Produto ===
export const PRODUCT_VIDEO_STYLES = [
  { id: 'rotation', name: 'Rotação Suave', description: 'Produto girando lentamente', prompt: 'slow 360 rotation, smooth camera movement, elegant product showcase' },
  { id: 'floating', name: 'Flutuando', description: 'Levitação + partículas', prompt: 'floating in mid-air, subtle levitation, magical particles around, ethereal lighting' },
  { id: 'splash', name: 'Splash Líquido', description: 'Gel, água, splash', prompt: 'liquid splash, water droplets, gel texture, dynamic fluid motion, high-speed capture feel' },
  { id: 'macro', name: 'Macro Close-up', description: 'Foco em detalhes', prompt: 'extreme close-up, macro lens, focus on texture and details, shallow depth of field' },
  { id: 'tech-premium-black', name: 'Tech Premium Black', description: 'Fundo escuro + reflexos', prompt: 'dark premium background, dramatic lighting, reflective surface, tech aesthetic, luxury feel' },
  { id: 'clean-studio', name: 'Clean Studio', description: 'Fundo branco minimalista', prompt: 'clean white studio background, soft shadows, minimalist, professional product photography' },
] as const;
