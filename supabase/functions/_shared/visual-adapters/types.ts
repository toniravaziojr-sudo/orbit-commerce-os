// =============================================
// VISUAL ADAPTERS — Generic Types & Contracts
// v1.0.0: Shared visual engine architecture for all visual blocks
// =============================================

// ===== STYLE TYPES (reuses existing creative-image-generate enums) =====

/** Output mode: how the generated image will be used */
export type OutputMode = 'editable' | 'complete';

/** Creative style: visual direction (same enum as creative-image-generate) */
export type ImageStyle = 'product_natural' | 'person_interacting' | 'promotional';

/** Render mode returned to frontend: overlay = needs HTML text on top, baked = finished piece */
export type RenderMode = 'overlay' | 'baked';

/** Composition hint for prompt building */
export type CompositionHint =
  | 'banner_desktop'   // 12:5, product right, safe area left
  | 'banner_mobile'    // 4:5, product center, safe area top
  | 'banner_desktop_complete' // 12:5, full composition, no safe areas
  | 'banner_mobile_complete'  // 4:5, full composition, no safe areas
  | 'square'           // 1:1
  | 'vertical'         // 9:16
  | 'horizontal'       // 16:9
  | 'free';            // no specific composition rules

// ===== GENERIC REQUEST =====

export interface VisualSlot {
  /** Key that maps to the block prop (e.g. 'imageDesktop', 'imageMobile') */
  key: string;
  width: number;
  height: number;
  label: string;
  /** Composition direction for this slot */
  composition: CompositionHint;
}

export interface ProductContext {
  name: string;
  description?: string;
  slug?: string;
  price?: number;
  compareAtPrice?: number;
  mainImageUrl?: string;
}

export interface CategoryContext {
  name: string;
  slug?: string;
}

export interface StoreContext {
  storeName: string;
  storeDescription?: string;
}

export interface VisualGenerationRequest {
  /** Block type identifier */
  blockType: string;
  
  /** How the image will be used: editable (for HTML overlay) or complete (finished piece) */
  outputMode: OutputMode;
  
  /** Creative visual direction */
  creativeStyle: ImageStyle;
  
  /** Per-style configuration (action, tone, environment, etc.) */
  styleConfig: Record<string, unknown>;
  
  /** User's briefing text */
  briefing: string;
  
  /** Product grounding context */
  product?: ProductContext | null;
  
  /** Category grounding context */
  category?: CategoryContext | null;
  
  /** Store identity context */
  store: StoreContext;
  
  /** Output slots to generate */
  slots: VisualSlot[];
  
  /** Enable QA scoring (optional, default false for Phase 1) */
  enableQA?: boolean;
  
  /** Slide index for carousel variation */
  slideIndex?: number;
}

// ===== GENERIC RESULT =====

export interface QAScores {
  realism: number;
  quality: number;
  composition: number;
  label: number;
  overall: number;
}

export interface GeneratedAsset {
  /** Maps to the requested slot key */
  slotKey: string;
  /** Public URL after upload */
  publicUrl: string;
  /** QA scores if enabled */
  score?: QAScores;
  /** Model that generated this asset */
  model: string;
}

export interface VisualGenerationResult {
  /** Generated assets (one per slot) */
  assets: GeneratedAsset[];
  /** How the frontend should render: overlay (needs HTML text) or baked (image is final) */
  renderMode: RenderMode;
  /** Generation metadata */
  metadata: {
    model: string;
    elapsed: number;
    qaEnabled: boolean;
    outputMode: OutputMode;
    creativeStyle: ImageStyle;
  };
}

// ===== BLOCK ADAPTER INTERFACE =====

export interface AdapterInput {
  /** Block-specific mode (e.g. 'single', 'carousel') */
  mode?: string;
  /** Output mode chosen by user */
  outputMode: OutputMode;
  /** Creative style chosen by user */
  creativeStyle: ImageStyle;
  /** Per-style config */
  styleConfig: Record<string, unknown>;
  /** User briefing */
  briefing: string;
  /** Per-slide or single context */
  contexts: SlideContext[];
  /** Store context */
  store: StoreContext;
  /** Enable QA */
  enableQA: boolean;
}

export interface SlideContext {
  product?: ProductContext | null;
  category?: CategoryContext | null;
  associationType?: string;
  briefing?: string;
}

/**
 * Block Visual Adapter interface.
 * Each visual block implements this to translate its needs to the engine.
 */
export interface BlockVisualAdapter {
  /** Translate block-specific input into generic generation requests */
  adapt(params: AdapterInput): VisualGenerationRequest[];
  
  /**
   * Merge generated results back into block props, respecting whitelist.
   * Returns only the props that should be updated.
   */
  mergeResults(
    results: VisualGenerationResult[],
    params: AdapterInput,
  ): Record<string, unknown>;
}
