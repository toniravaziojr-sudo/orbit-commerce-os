// =============================================
// LANDING PAGE ASSET RESOLVER — V7
// Deterministic resolution of images per LP slot
// =============================================

interface ProductImageData {
  product_id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

export interface ResolvedAssets {
  heroImageUrl: string;
  heroBackgroundUrl: string;
  heroSceneDesktopUrl: string;
  heroSceneMobileUrl: string;
  offerCardImages: Record<string, string>; // product_id → primary image URL
  socialProofImages: string[];
  benefitImages: string[];
}

export interface AssetResolverInput {
  supabase: any;
  tenantId: string;
  productIds: string[];
  kitProductIds: string[];
  niche: string;
}

/**
 * Deterministically resolves images for each LP slot.
 * No AI involvement — pure data lookups.
 */
export async function resolveLandingPageAssets(input: AssetResolverInput): Promise<ResolvedAssets> {
  const { supabase, tenantId, productIds, kitProductIds, niche } = input;

  // 1. Fetch all product images for main products + kits
  const allProductIds = [...new Set([...productIds, ...kitProductIds])];
  const primaryImageByProduct = new Map<string, string>();
  const allImagesByProduct = new Map<string, string[]>();

  if (allProductIds.length > 0) {
    const { data: images } = await supabase
      .from('product_images')
      .select('product_id, url, is_primary, sort_order')
      .in('product_id', allProductIds)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true });

    for (const img of (images || []) as ProductImageData[]) {
      if (!allImagesByProduct.has(img.product_id)) {
        allImagesByProduct.set(img.product_id, []);
      }
      allImagesByProduct.get(img.product_id)!.push(img.url);
      if (img.is_primary && !primaryImageByProduct.has(img.product_id)) {
        primaryImageByProduct.set(img.product_id, img.url);
      }
    }

    // Fallback: if no is_primary, use first image
    for (const pid of allProductIds) {
      if (!primaryImageByProduct.has(pid)) {
        const imgs = allImagesByProduct.get(pid);
        if (imgs && imgs.length > 0) {
          primaryImageByProduct.set(pid, imgs[0]);
        }
      }
    }
  }

  // 2. Hero image = primary image of first product
  const mainProductId = productIds[0];
  const heroImageUrl = primaryImageByProduct.get(mainProductId) || '';

  // 3. Hero background = stock image by niche (imported dynamically)
  const { getNicheImage } = await import('./landing-page-stock-images.ts');
  const heroBackgroundUrl = getNicheImage(niche, 'hero', 0);

  // 4. Offer card images = primary image per kit/product
  const offerCardImages: Record<string, string> = {};
  for (const kitId of kitProductIds) {
    offerCardImages[kitId] = primaryImageByProduct.get(kitId) || heroImageUrl;
  }
  // Also include main products
  for (const pid of productIds) {
    if (!offerCardImages[pid]) {
      offerCardImages[pid] = primaryImageByProduct.get(pid) || '';
    }
  }

  // 5. Social proof images from Drive — V8.0: broader search with priority + fallback
  const socialProofImages: string[] = [];
  try {
    // Step 1: Search folders with relevant names (highest priority)
    const { data: proofFolders } = await supabase
      .from('files')
      .select('id, filename')
      .eq('tenant_id', tenantId)
      .eq('is_folder', true)
      .or('filename.ilike.%feedback%,filename.ilike.%review%,filename.ilike.%prova%,filename.ilike.%resultado%,filename.ilike.%depoimento%,filename.ilike.%antes%,filename.ilike.%depois%,filename.ilike.%social%,filename.ilike.%cliente%')
      .limit(10);

    const relevantFolderIds = proofFolders?.map((f: any) => f.id) || [];
    console.log(`[AssetResolver] Social proof: found ${relevantFolderIds.length} relevant folders: ${proofFolders?.map((f: any) => f.filename).join(', ') || 'none'}`);

    // Step 2: Get images from relevant folders
    if (relevantFolderIds.length > 0) {
      const { data: proofFiles } = await supabase
        .from('files')
        .select('id, storage_path, mime_type, metadata')
        .eq('tenant_id', tenantId)
        .eq('is_folder', false)
        .ilike('mime_type', 'image/%')
        .in('folder_id', relevantFolderIds)
        .order('created_at', { ascending: false })
        .limit(24);

      if (proofFiles) {
        for (const file of proofFiles) {
          const url = resolveFileUrl(supabase, file);
          if (url) socialProofImages.push(typeof url === 'string' ? url : await url);
        }
      }
    }

    // Step 3: Fallback — if not enough images, search ALL tenant image files (non-folder)
    if (socialProofImages.length < 3) {
      console.log(`[AssetResolver] Social proof fallback: only ${socialProofImages.length} images, searching all tenant images...`);
      const { data: allImages } = await supabase
        .from('files')
        .select('id, storage_path, mime_type, metadata, filename')
        .eq('tenant_id', tenantId)
        .eq('is_folder', false)
        .ilike('mime_type', 'image/%')
        .not('storage_path', 'ilike', '%lp-creatives%') // exclude AI-generated scenes
        .order('created_at', { ascending: false })
        .limit(30);

      if (allImages) {
        const existingSet = new Set(socialProofImages);
        for (const file of allImages) {
          if (socialProofImages.length >= 24) break;
          const url = resolveFileUrl(supabase, file);
          const resolved = typeof url === 'string' ? url : await url;
          if (resolved && !existingSet.has(resolved)) {
            socialProofImages.push(resolved);
            existingSet.add(resolved);
          }
        }
      }
    }

    if (socialProofImages.length === 0) {
      console.warn(`[AssetResolver] ⚠️ WARNING: No social proof images found for tenant ${tenantId}. SocialProof section will be skipped.`);
    } else {
      console.log(`[AssetResolver] Social proof: resolved ${socialProofImages.length} images total`);
    }
  } catch (e) {
    console.warn(`[AssetResolver] Social proof search error (non-blocking):`, e);
  }

  // 6. Benefit images = mix of product secondary images + stock
  const mainProductImages = allImagesByProduct.get(mainProductId) || [];
  const stockBenefitImages = [
    getNicheImage(niche, 'benefits', 0),
    getNicheImage(niche, 'benefits', 1),
    getNicheImage(niche, 'benefits', 2),
  ];

  const benefitImages = [
    mainProductImages[0] || stockBenefitImages[0],
    stockBenefitImages[0] || mainProductImages[1] || mainProductImages[0] || '',
    mainProductImages[2] || mainProductImages[1] || stockBenefitImages[1] || mainProductImages[0] || '',
  ];

  // 7. Scene URLs — initially empty, filled by enhance-images pipeline
  const heroSceneDesktopUrl = '';
  const heroSceneMobileUrl = '';

  console.log(`[AssetResolver] Resolved: hero=${!!heroImageUrl}, bg=${!!heroBackgroundUrl}, sceneDesktop=${!!heroSceneDesktopUrl}, sceneMobile=${!!heroSceneMobileUrl}, kits=${Object.keys(offerCardImages).length}, proof=${socialProofImages.length}, benefits=${benefitImages.filter(Boolean).length}`);

  return {
    heroImageUrl,
    heroBackgroundUrl,
    heroSceneDesktopUrl,
    heroSceneMobileUrl,
    offerCardImages,
    socialProofImages,
    benefitImages,
  };
}
