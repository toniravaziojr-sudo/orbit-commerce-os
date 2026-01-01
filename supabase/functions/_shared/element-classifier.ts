// =====================================================
// ELEMENT CLASSIFIER v2 - WITH DETAILED LOGGING
// =====================================================
// Classifies extracted elements into native block types
// Determines confidence level and whether new block is needed
// =====================================================

import type { ExtractedElement, ElementType } from './element-extractor.ts';

export interface ClassifiedElement extends ExtractedElement {
  blockType: string;
  blockProps: Record<string, unknown>;
  confidence: number; // 0-1
  needsNewBlock: boolean;
  suggestedBlockName?: string;
}

// =====================================================
// VIDEO CLASSIFICATION
// =====================================================
function classifyVideo(element: ExtractedElement): ClassifiedElement {
  const { videoId, videoSource, videoUrl } = element.metadata;
  
  console.log(`[FUNC:classifyVideo] INPUT: ${JSON.stringify({ 
    elementId: element.id, 
    videoId, 
    videoSource, 
    videoUrl 
  })}`);
  
  let result: ClassifiedElement;
  
  if (videoSource === 'youtube' && videoId) {
    result = {
      ...element,
      blockType: 'YouTubeVideo',
      blockProps: {
        youtubeUrl: videoUrl || `https://www.youtube.com/watch?v=${videoId}`,
        videoId: videoId,
        title: '',
        showControls: true,
      },
      confidence: 1.0,
      needsNewBlock: false,
    };
  } else if (videoSource === 'vimeo' && videoId) {
    result = {
      ...element,
      blockType: 'YouTubeVideo', // We use same block for Vimeo
      blockProps: {
        youtubeUrl: `https://vimeo.com/${videoId}`,
        videoId: videoId,
        title: '',
        showControls: true,
      },
      confidence: 0.9,
      needsNewBlock: false,
    };
  } else {
    // Unknown video source - use CustomBlock
    result = {
      ...element,
      blockType: 'CustomBlock',
      blockProps: {
        htmlContent: element.rawHtml,
        blockName: 'Vídeo Importado',
      },
      confidence: 0.5,
      needsNewBlock: false,
    };
  }
  
  console.log(`[FUNC:classifyVideo] OUTPUT: ${JSON.stringify({ 
    blockType: result.blockType, 
    confidence: result.confidence, 
    needsNewBlock: result.needsNewBlock 
  })}`);
  
  return result;
}

// =====================================================
// VIDEO CAROUSEL CLASSIFICATION
// =====================================================
function classifyVideoCarousel(element: ExtractedElement): ClassifiedElement {
  const { videos } = element.metadata;
  
  console.log(`[FUNC:classifyVideoCarousel] INPUT: ${JSON.stringify({ 
    elementId: element.id, 
    videosCount: videos?.length 
  })}`);
  
  let result: ClassifiedElement;
  
  if (videos && videos.length >= 2) {
    // Convert to VideoCarousel block format
    const videosJson = videos.map(v => v.url).join('\n');
    
    result = {
      ...element,
      blockType: 'VideoCarousel',
      blockProps: {
        videosJson: videosJson,
        showControls: true,
        autoplay: false,
        slidesPerView: Math.min(3, videos.length),
        gap: 16,
      },
      confidence: 0.95,
      needsNewBlock: false,
    };
  } else {
    // Fallback
    result = {
      ...element,
      blockType: 'CustomBlock',
      blockProps: {
        htmlContent: element.rawHtml,
        blockName: 'Carrossel de Vídeos',
      },
      confidence: 0.5,
      needsNewBlock: true,
      suggestedBlockName: 'VideoCarousel',
    };
  }
  
  console.log(`[FUNC:classifyVideoCarousel] OUTPUT: ${JSON.stringify({ 
    blockType: result.blockType, 
    confidence: result.confidence, 
    needsNewBlock: result.needsNewBlock 
  })}`);
  
  return result;
}

// =====================================================
// IMAGE CLASSIFICATION
// =====================================================
function classifyImage(element: ExtractedElement): ClassifiedElement {
  const { imageDesktop, imageMobile, imageAlt } = element.metadata;
  
  console.log(`[FUNC:classifyImage] INPUT: ${JSON.stringify({ 
    elementId: element.id, 
    imageDesktop: imageDesktop?.substring(0, 50), 
    imageMobile: imageMobile?.substring(0, 50), 
    imageAlt 
  })}`);
  
  let result: ClassifiedElement;
  
  if (imageDesktop) {
    result = {
      ...element,
      blockType: 'Image',
      blockProps: {
        imageDesktop: imageDesktop,
        imageMobile: imageMobile || imageDesktop,
        alt: imageAlt || '',
        linkUrl: '',
        objectFit: 'contain',
      },
      confidence: 0.95,
      needsNewBlock: false,
    };
  } else {
    // Fallback
    result = {
      ...element,
      blockType: 'CustomBlock',
      blockProps: {
        htmlContent: element.rawHtml,
        blockName: 'Imagem',
      },
      confidence: 0.4,
      needsNewBlock: false,
    };
  }
  
  console.log(`[FUNC:classifyImage] OUTPUT: ${JSON.stringify({ 
    blockType: result.blockType, 
    confidence: result.confidence, 
    needsNewBlock: result.needsNewBlock 
  })}`);
  
  return result;
}

// =====================================================
// HEADING CLASSIFICATION
// =====================================================
function classifyHeading(element: ExtractedElement): ClassifiedElement {
  const { level, text, content, styles } = element.metadata;
  
  console.log(`[FUNC:classifyHeading] INPUT: ${JSON.stringify({ 
    elementId: element.id, 
    level, 
    text: text?.substring(0, 40) 
  })}`);
  
  // Build HTML with preserved styling
  let htmlContent = `<${level}`;
  
  if (styles && Object.keys(styles).length > 0) {
    const styleStr = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
      .join('; ');
    htmlContent += ` style="${styleStr}"`;
  }
  
  htmlContent += `>${content || text}</${level}>`;
  
  const result: ClassifiedElement = {
    ...element,
    blockType: 'RichText',
    blockProps: {
      content: htmlContent,
      fontFamily: styles?.fontFamily || 'inherit',
      fontSize: 'base',
      fontWeight: 'normal',
    },
    confidence: 0.95,
    needsNewBlock: false,
  };
  
  console.log(`[FUNC:classifyHeading] OUTPUT: ${JSON.stringify({ 
    blockType: result.blockType, 
    confidence: result.confidence, 
    needsNewBlock: result.needsNewBlock 
  })}`);
  
  return result;
}

// =====================================================
// BUTTON CLASSIFICATION
// =====================================================
function classifyButton(element: ExtractedElement): ClassifiedElement {
  const { buttonText, buttonUrl, buttonVariant } = element.metadata;
  
  console.log(`[FUNC:classifyButton] INPUT: ${JSON.stringify({ 
    elementId: element.id, 
    buttonText, 
    buttonUrl: buttonUrl?.substring(0, 40), 
    buttonVariant 
  })}`);
  
  let result: ClassifiedElement;
  
  if (buttonText && buttonText.length >= 2) {
    result = {
      ...element,
      blockType: 'Button',
      blockProps: {
        text: buttonText,
        url: buttonUrl || '#',
        variant: buttonVariant || 'primary',
        size: 'lg',
        fullWidth: false,
        alignment: 'center',
      },
      confidence: 0.9,
      needsNewBlock: false,
    };
  } else {
    // Fallback
    result = {
      ...element,
      blockType: 'CustomBlock',
      blockProps: {
        htmlContent: element.rawHtml,
        blockName: 'Botão',
      },
      confidence: 0.4,
      needsNewBlock: false,
    };
  }
  
  console.log(`[FUNC:classifyButton] OUTPUT: ${JSON.stringify({ 
    blockType: result.blockType, 
    confidence: result.confidence, 
    needsNewBlock: result.needsNewBlock 
  })}`);
  
  return result;
}

// =====================================================
// TEXT CLASSIFICATION
// =====================================================
function classifyText(element: ExtractedElement): ClassifiedElement {
  const { text, content } = element.metadata;
  
  console.log(`[FUNC:classifyText] INPUT: ${JSON.stringify({ 
    elementId: element.id, 
    textLength: text?.length, 
    textPreview: text?.substring(0, 40) 
  })}`);
  
  const result: ClassifiedElement = {
    ...element,
    blockType: 'RichText',
    blockProps: {
      content: content || `<p>${text}</p>`,
      fontFamily: 'inherit',
      fontSize: 'base',
      fontWeight: 'normal',
    },
    confidence: 0.85,
    needsNewBlock: false,
  };
  
  console.log(`[FUNC:classifyText] OUTPUT: ${JSON.stringify({ 
    blockType: result.blockType, 
    confidence: result.confidence, 
    needsNewBlock: result.needsNewBlock 
  })}`);
  
  return result;
}

// =====================================================
// FAQ CLASSIFICATION
// =====================================================
function classifyFAQ(element: ExtractedElement): ClassifiedElement {
  const { faqItems, faqTitle } = element.metadata;
  
  console.log(`[FUNC:classifyFAQ] INPUT: ${JSON.stringify({ 
    elementId: element.id, 
    faqItemsCount: faqItems?.length, 
    faqTitle 
  })}`);
  
  let result: ClassifiedElement;
  
  if (faqItems && faqItems.length >= 2) {
    result = {
      ...element,
      blockType: 'FAQ',
      blockProps: {
        title: faqTitle || 'Perguntas Frequentes',
        titleAlign: 'left',
        items: faqItems,
        allowMultiple: false,
      },
      confidence: 0.95,
      needsNewBlock: false,
    };
  } else {
    // Fallback if too few items
    result = {
      ...element,
      blockType: 'CustomBlock',
      blockProps: {
        htmlContent: element.rawHtml,
        blockName: 'FAQ',
      },
      confidence: 0.5,
      needsNewBlock: false,
    };
  }
  
  console.log(`[FUNC:classifyFAQ] OUTPUT: ${JSON.stringify({ 
    blockType: result.blockType, 
    confidence: result.confidence, 
    needsNewBlock: result.needsNewBlock 
  })}`);
  
  return result;
}

// =====================================================
// TESTIMONIAL CLASSIFICATION
// =====================================================
function classifyTestimonial(element: ExtractedElement): ClassifiedElement {
  const { testimonialItems, testimonialTitle } = element.metadata;
  
  console.log(`[FUNC:classifyTestimonial] INPUT: ${JSON.stringify({ 
    elementId: element.id, 
    testimonialItemsCount: testimonialItems?.length, 
    testimonialTitle 
  })}`);
  
  let result: ClassifiedElement;
  
  if (testimonialItems && testimonialItems.length >= 2) {
    result = {
      ...element,
      blockType: 'Testimonials',
      blockProps: {
        title: testimonialTitle || 'Depoimentos',
        items: testimonialItems,
      },
      confidence: 0.95,
      needsNewBlock: false,
    };
  } else {
    // Fallback
    result = {
      ...element,
      blockType: 'CustomBlock',
      blockProps: {
        htmlContent: element.rawHtml,
        blockName: 'Depoimentos',
      },
      confidence: 0.5,
      needsNewBlock: false,
    };
  }
  
  console.log(`[FUNC:classifyTestimonial] OUTPUT: ${JSON.stringify({ 
    blockType: result.blockType, 
    confidence: result.confidence, 
    needsNewBlock: result.needsNewBlock 
  })}`);
  
  return result;
}

// =====================================================
// UNKNOWN/FALLBACK CLASSIFICATION
// =====================================================
function classifyUnknown(element: ExtractedElement): ClassifiedElement {
  console.log(`[FUNC:classifyUnknown] INPUT: ${JSON.stringify({ 
    elementId: element.id, 
    type: element.type 
  })}`);
  
  const result: ClassifiedElement = {
    ...element,
    blockType: 'CustomBlock',
    blockProps: {
      htmlContent: element.rawHtml,
      blockName: `Seção ${element.type}`,
    },
    confidence: 0.3,
    needsNewBlock: true,
    suggestedBlockName: element.type,
  };
  
  console.log(`[FUNC:classifyUnknown] OUTPUT: ${JSON.stringify({ 
    blockType: result.blockType, 
    confidence: result.confidence, 
    needsNewBlock: result.needsNewBlock 
  })}`);
  
  return result;
}

// =====================================================
// MAIN CLASSIFICATION FUNCTION
// =====================================================
export function classifyElement(element: ExtractedElement): ClassifiedElement {
  console.log(`[FUNC:classifyElement] INPUT: ${JSON.stringify({ 
    id: element.id, 
    type: element.type, 
    position: element.position,
    textPreview: (element.metadata.text || element.metadata.buttonText || '').substring(0, 40) 
  })}`);
  
  let result: ClassifiedElement;
  
  switch (element.type) {
    case 'video':
      result = classifyVideo(element);
      break;
    case 'video-carousel':
      result = classifyVideoCarousel(element);
      break;
    case 'image':
      result = classifyImage(element);
      break;
    case 'image-carousel':
      result = classifyImage(element); // Use same as image for now
      break;
    case 'heading':
      result = classifyHeading(element);
      break;
    case 'button':
      result = classifyButton(element);
      break;
    case 'text':
      result = classifyText(element);
      break;
    case 'faq':
      result = classifyFAQ(element);
      break;
    case 'testimonial':
      result = classifyTestimonial(element);
      break;
    default:
      result = classifyUnknown(element);
  }
  
  console.log(`[FUNC:classifyElement] OUTPUT: ${JSON.stringify({ 
    inputType: element.type, 
    outputBlockType: result.blockType, 
    confidence: result.confidence 
  })}`);
  
  return result;
}

// Classify all elements
export function classifyAllElements(elements: ExtractedElement[]): ClassifiedElement[] {
  const startTime = Date.now();
  console.log(`[FUNC:classifyAllElements] INPUT: ${JSON.stringify({ 
    elementsCount: elements.length, 
    types: elements.map(e => e.type) 
  })}`);
  
  const classified = elements.map((element, index) => {
    console.log(`[FUNC:classifyAllElements] PROCESSING[${index}]: ${element.type} @ position ${element.position}`);
    return classifyElement(element);
  });
  
  // Log summary
  const blockTypes = classified.map(c => c.blockType);
  const typeCounts = blockTypes.reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const needsNew = classified.filter(c => c.needsNewBlock);
  
  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:classifyAllElements] OUTPUT: ${JSON.stringify({ 
    classifiedCount: classified.length, 
    blockTypes: typeCounts,
    needsNewBlockCount: needsNew.length,
    needsNewBlockNames: needsNew.map(c => c.suggestedBlockName),
    elapsedMs: elapsed 
  })}`);
  
  return classified;
}
