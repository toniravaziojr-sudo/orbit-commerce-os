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

  // 5. Social proof images from Drive
  const socialProofImages: string[] = [];
  try {
    const { data: proofFolders } = await supabase
      .from('files')
      .select('id, filename, storage_path')
      .eq('tenant_id', tenantId)
      .eq('is_folder', true)
      .or('filename.ilike.%feedback%,filename.ilike.%review%,filename.ilike.%prova%,filename.ilike.%resultado%,filename.ilike.%depoimento%')
      .limit(10);

    if (proofFolders && proofFolders.length > 0) {
      const orConditions = proofFolders
        .map((f: any) => {
          const path = f.storage_path || `drive/${tenantId}/${f.filename}`;
          return `storage_path.like.${path}/%`;
        })
        .join(',');

      const { data: proofFiles } = await supabase
        .from('files')
        .select('id, storage_path, mime_type, metadata')
        .eq('tenant_id', tenantId)
        .eq('is_folder', false)
        .ilike('mime_type', 'image/%')
        .or(orConditions)
        .order('created_at', { ascending: false })
        .limit(5);

      if (proofFiles) {
        for (const file of proofFiles) {
          try {
            const meta = file.metadata as Record<string, any> | null;
            let imageUrl = meta?.url as string | undefined;
            if (!imageUrl) {
              const bucket = (meta?.bucket as string) || 'tenant-files';
              if (bucket === 'tenant-files') {
                const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(file.storage_path, 3600);
                imageUrl = signedData?.signedUrl;
              } else {
                const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(file.storage_path);
                imageUrl = pubData?.publicUrl;
              }
            }
            if (imageUrl) socialProofImages.push(imageUrl);
          } catch {
            // non-blocking
          }
        }
      }
    }
  } catch {
    // non-blocking
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

  console.log(`[AssetResolver] Resolved: hero=${!!heroImageUrl}, bg=${!!heroBackgroundUrl}, kits=${Object.keys(offerCardImages).length}, proof=${socialProofImages.length}, benefits=${benefitImages.filter(Boolean).length}`);

  return {
    heroImageUrl,
    heroBackgroundUrl,
    offerCardImages,
    socialProofImages,
    benefitImages,
  };
}
