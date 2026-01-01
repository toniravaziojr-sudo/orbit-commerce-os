// =============================================
// VIDEO MATERIALIZER - Convert placeholders to real iframes
// =============================================
// Shopify/Dooca/Tray pages often have YouTube/Vimeo as:
// - data-attributes (data-youtube, data-video-id, data-src)
// - Lazy-load wrappers that require JS
// - Thumbnail images with play buttons
// - Protocol-relative URLs (//youtube.com)
// 
// This module materializes ALL video patterns into real <iframe> elements
// =============================================

interface MaterializationResult {
  html: string;
  videosFound: number;
  patterns: string[];
}

// Generate responsive YouTube iframe HTML
function createYouTubeEmbed(videoId: string): string {
  return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;">
    <iframe 
      src="https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0" 
      style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
      allowfullscreen>
    </iframe>
  </div>`;
}

// Generate responsive Vimeo iframe HTML
function createVimeoEmbed(videoId: string): string {
  return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;">
    <iframe 
      src="https://player.vimeo.com/video/${videoId}" 
      style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" 
      allow="autoplay; fullscreen; picture-in-picture" 
      allowfullscreen>
    </iframe>
  </div>`;
}

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/i,
    /^([a-zA-Z0-9_-]{11})$/, // Just the ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Extract Vimeo video ID from URL
function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match ? match[1] : null;
}

export function materializeVideos(html: string): MaterializationResult {
  if (!html) return { html, videosFound: 0, patterns: [] };
  
  let content = html;
  let videosFound = 0;
  const patternsUsed: string[] = [];
  
  // =============================================
  // YOUTUBE PATTERNS
  // =============================================
  
  // Pattern 1: data-youtube or data-video-id or data-youtube-id attributes
  // <div data-youtube="VIDEO_ID"> or <div data-video-id="VIDEO_ID">
  const dataYoutubeAttrPattern = /<([a-z]+)[^>]*(?:data-youtube|data-video-id|data-youtube-id|data-yt-id)=["']([a-zA-Z0-9_-]{11})["'][^>]*>[\s\S]*?<\/\1>/gi;
  content = content.replace(dataYoutubeAttrPattern, (match, tag, videoId) => {
    videosFound++;
    patternsUsed.push('data-youtube-attr');
    console.log(`[VIDEO] Pattern 1 - data-attr: ${videoId}`);
    return createYouTubeEmbed(videoId);
  });
  
  // Pattern 2: data-src with YouTube URL (lazy loading iframes)
  // <iframe data-src="https://www.youtube.com/embed/VIDEO_ID">
  const dataSrcYoutubePattern = /<iframe([^>]*)data-src=["']([^"']*(?:youtube\.com|youtu\.be)[^"']*)["']([^>]*)>/gi;
  content = content.replace(dataSrcYoutubePattern, (match, before, dataSrc, after) => {
    const videoId = extractYouTubeId(dataSrc);
    if (videoId) {
      videosFound++;
      patternsUsed.push('data-src-iframe');
      console.log(`[VIDEO] Pattern 2 - data-src iframe: ${videoId}`);
      // Just convert data-src to src
      return `<iframe${before}src="${dataSrc}"${after}>`;
    }
    return match;
  });
  
  // Pattern 3: YouTube links with play button/video class
  // <a href="https://www.youtube.com/watch?v=VIDEO_ID" class="video-play">
  const youtubeLinkPattern = /<a[^>]*href=["'](?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})[^"']*["'][^>]*>[\s\S]*?<\/a>/gi;
  content = content.replace(youtubeLinkPattern, (match, videoId) => {
    // Only replace if it looks like a video trigger (has video/play class or image)
    if (/class=["'][^"']*(?:video|play|youtube|modal)[^"']*["']/i.test(match) || 
        /<img/i.test(match)) {
      videosFound++;
      patternsUsed.push('youtube-link');
      console.log(`[VIDEO] Pattern 3 - YouTube link: ${videoId}`);
      return createYouTubeEmbed(videoId);
    }
    return match;
  });
  
  // Pattern 4: YouTube thumbnail images (ytimg.com)
  // <img src="...ytimg.com/vi/VIDEO_ID/...">
  const ytThumbnailPattern = /<(?:div|figure|span)[^>]*>[\s\S]*?<img[^>]*src=["'][^"']*(?:ytimg\.com|i\.ytimg\.com)\/vi\/([a-zA-Z0-9_-]{11})[^"']*["'][^>]*>[\s\S]*?<\/(?:div|figure|span)>/gi;
  content = content.replace(ytThumbnailPattern, (match, videoId) => {
    videosFound++;
    patternsUsed.push('yt-thumbnail');
    console.log(`[VIDEO] Pattern 4 - YT thumbnail: ${videoId}`);
    return createYouTubeEmbed(videoId);
  });
  
  // Pattern 5: Generic data-url/data-video/data-embed with YouTube URL
  const anyDataYoutubePattern = /<([a-z]+)[^>]*(?:data-url|data-video|data-embed|data-video-url)=["']([^"']*(?:youtube\.com|youtu\.be)[^"']*)["'][^>]*>[\s\S]*?<\/\1>/gi;
  content = content.replace(anyDataYoutubePattern, (match, tag, fullUrl) => {
    const videoId = extractYouTubeId(fullUrl);
    if (videoId) {
      videosFound++;
      patternsUsed.push('data-url-youtube');
      console.log(`[VIDEO] Pattern 5 - data-url: ${videoId}`);
      return createYouTubeEmbed(videoId);
    }
    return match;
  });
  
  // Pattern 6: Dooca-specific video patterns
  // <div class="video-dooca" data-video="VIDEO_ID">
  const doocaVideoPattern = /<([a-z]+)[^>]*class=["'][^"']*(?:video-dooca|dooca-video|video-wrapper)[^"']*["'][^>]*data-(?:video|id)=["']([a-zA-Z0-9_-]{11})["'][^>]*>[\s\S]*?<\/\1>/gi;
  content = content.replace(doocaVideoPattern, (match, tag, videoId) => {
    videosFound++;
    patternsUsed.push('dooca-video');
    console.log(`[VIDEO] Pattern 6 - Dooca: ${videoId}`);
    return createYouTubeEmbed(videoId);
  });
  
  // Pattern 7: Shopify video sections
  // <div class="shopify-section--video" data-youtube-id="VIDEO_ID">
  const shopifyVideoPattern = /<([a-z]+)[^>]*class=["'][^"']*shopify-section[^"']*video[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi;
  content = content.replace(shopifyVideoPattern, (match, tag) => {
    // Extract video ID from within the section
    const idMatch = match.match(/data-(?:youtube-id|video-id|yt-id)=["']([a-zA-Z0-9_-]{11})["']/i);
    if (idMatch) {
      videosFound++;
      patternsUsed.push('shopify-video-section');
      console.log(`[VIDEO] Pattern 7 - Shopify section: ${idMatch[1]}`);
      return createYouTubeEmbed(idMatch[1]);
    }
    return match;
  });
  
  // Pattern 8: Protocol-relative YouTube/Vimeo URLs (//www.youtube.com)
  content = content.replace(/src=["']\/\/(?:www\.)?youtube\.com/gi, 'src="https://www.youtube.com');
  content = content.replace(/src=["']\/\/(?:www\.)?youtu\.be/gi, 'src="https://youtu.be');
  content = content.replace(/src=["']\/\/player\.vimeo\.com/gi, 'src="https://player.vimeo.com');
  
  // Pattern 9: Existing YouTube iframes missing protocol
  const noProtocolYoutubePattern = /<iframe[^>]*src=["'](?!https?:)([^"']*youtube\.com[^"']*)["'][^>]*>/gi;
  content = content.replace(noProtocolYoutubePattern, (match, url) => {
    videosFound++;
    patternsUsed.push('fix-protocol');
    return match.replace(url, `https:${url.startsWith('//') ? url : '//' + url}`);
  });
  
  // =============================================
  // VIMEO PATTERNS
  // =============================================
  
  // Pattern 10: data-src Vimeo (lazy load)
  const vimeoDataSrcPattern = /<iframe([^>]*)data-src=["']([^"']*vimeo\.com[^"']*)["']([^>]*)>/gi;
  content = content.replace(vimeoDataSrcPattern, (match, before, dataSrc, after) => {
    videosFound++;
    patternsUsed.push('vimeo-data-src');
    console.log(`[VIDEO] Pattern 10 - Vimeo data-src`);
    return `<iframe${before}src="${dataSrc}"${after}>`;
  });
  
  // Pattern 11: Vimeo links with video class
  const vimeoLinkPattern = /<a[^>]*href=["'](?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)[^"']*["'][^>]*class=["'][^"']*(?:video|play)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi;
  content = content.replace(vimeoLinkPattern, (match, videoId) => {
    videosFound++;
    patternsUsed.push('vimeo-link');
    console.log(`[VIDEO] Pattern 11 - Vimeo link: ${videoId}`);
    return createVimeoEmbed(videoId);
  });
  
  // Pattern 12: Data attributes with Vimeo
  const vimeoDataPattern = /<([a-z]+)[^>]*data-(?:vimeo|video-id)=["'](\d+)["'][^>]*>[\s\S]*?<\/\1>/gi;
  content = content.replace(vimeoDataPattern, (match, tag, videoId) => {
    videosFound++;
    patternsUsed.push('vimeo-data-attr');
    console.log(`[VIDEO] Pattern 12 - Vimeo data-attr: ${videoId}`);
    return createVimeoEmbed(videoId);
  });
  
  // Log summary
  if (videosFound > 0) {
    console.log(`[VIDEO] Materialized ${videosFound} video(s) using patterns: ${[...new Set(patternsUsed)].join(', ')}`);
  }
  
  return {
    html: content,
    videosFound,
    patterns: [...new Set(patternsUsed)],
  };
}

// Quick check if HTML contains video content that needs materialization
export function hasVideoContent(html: string): boolean {
  const videoIndicators = [
    /youtube\.com|youtu\.be/i,
    /vimeo\.com/i,
    /data-youtube|data-video-id|data-yt-id/i,
    /ytimg\.com\/vi\//i,
    /class=["'][^"']*video[^"']*["']/i,
  ];
  
  return videoIndicators.some(pattern => pattern.test(html));
}
