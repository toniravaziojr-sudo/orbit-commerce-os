// =============================================
// SOCIAL FEED BLOCK - Social media integration
// =============================================

import React from 'react';
import { Instagram, Facebook, Twitter, Youtube, ExternalLink, Heart, MessageCircle, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SocialPost {
  imageUrl?: string;
  caption?: string;
  likes?: number;
  comments?: number;
  link?: string;
}

interface SocialFeedBlockProps {
  title?: string;
  subtitle?: string;
  platform?: 'instagram' | 'facebook' | 'twitter';
  layout?: 'grid' | 'carousel' | 'masonry';
  columns?: 2 | 3 | 4 | 6;
  showCaption?: boolean;
  showStats?: boolean;
  maxPosts?: number;
  // Manual posts (when not using API)
  posts?: SocialPost[];
  // Profile info
  showProfile?: boolean;
  profileUsername?: string;
  profileUrl?: string;
  followButtonText?: string;
  // Styling
  gap?: 'sm' | 'md' | 'lg';
  rounded?: boolean;
  hoverEffect?: boolean;
  backgroundColor?: string;
  isEditing?: boolean;
}

const defaultPosts: SocialPost[] = [
  { imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=400&fit=crop', likes: 234, comments: 12 },
  { imageUrl: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=400&fit=crop', likes: 189, comments: 8 },
  { imageUrl: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400&h=400&fit=crop', likes: 321, comments: 24 },
  { imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=400&fit=crop', likes: 156, comments: 5 },
  { imageUrl: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&h=400&fit=crop', likes: 267, comments: 18 },
  { imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=400&fit=crop', likes: 198, comments: 9 },
];

const PlatformIcon = ({ platform }: { platform: string }) => {
  switch (platform) {
    case 'facebook':
      return <Facebook className="w-5 h-5" />;
    case 'twitter':
      return <Twitter className="w-5 h-5" />;
    default:
      return <Instagram className="w-5 h-5" />;
  }
};

export function SocialFeedBlock({
  title = 'Siga-nos no Instagram',
  subtitle = 'Acompanhe as novidades e compartilhe seus momentos conosco!',
  platform = 'instagram',
  layout = 'grid',
  columns = 6,
  showCaption = false,
  showStats = true,
  maxPosts = 6,
  posts = defaultPosts,
  showProfile = true,
  profileUsername = '@sualoja',
  profileUrl = 'https://instagram.com/sualoja',
  followButtonText = 'Seguir',
  gap = 'sm',
  rounded = true,
  hoverEffect = true,
  backgroundColor,
  isEditing,
}: SocialFeedBlockProps) {
  const displayPosts = posts.slice(0, maxPosts);

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  const columnClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
    6: 'grid-cols-3 sm:grid-cols-6',
  };

  const containerStyle: React.CSSProperties = {
    backgroundColor: backgroundColor || undefined,
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  return (
    <div className="py-12 px-4" style={containerStyle}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {title && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <PlatformIcon platform={platform} />
              <h2 className="text-2xl font-bold">{title}</h2>
            </div>
          )}
          {subtitle && (
            <p className="text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {/* Profile Section */}
        {showProfile && (
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-500 p-0.5">
                <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                  <PlatformIcon platform={platform} />
                </div>
              </div>
              <div>
                <a 
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold hover:underline"
                >
                  {profileUsername}
                </a>
                <p className="text-sm text-muted-foreground">
                  {displayPosts.length} publicações
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                {followButtonText}
              </a>
            </Button>
          </div>
        )}

        {/* Grid of Posts */}
        <div className={cn(
          "grid",
          columnClasses[columns],
          gapClasses[gap]
        )}>
          {displayPosts.map((post, index) => (
            <a
              key={index}
              href={post.link || profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group relative aspect-square overflow-hidden",
                rounded && "rounded-lg",
                "bg-muted"
              )}
            >
              {post.imageUrl ? (
                <img
                  src={post.imageUrl}
                  alt={post.caption || `Post ${index + 1}`}
                  className={cn(
                    "w-full h-full object-cover transition-transform duration-300",
                    hoverEffect && "group-hover:scale-110"
                  )}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PlatformIcon platform={platform} />
                </div>
              )}

              {/* Overlay on Hover */}
              {(showStats || showCaption) && (
                <div className={cn(
                  "absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 transition-opacity duration-300",
                  "group-hover:opacity-100"
                )}>
                  {showStats && (
                    <div className="flex items-center gap-4 text-white">
                      <div className="flex items-center gap-1">
                        <Heart className="w-5 h-5" />
                        <span className="text-sm font-medium">
                          {formatNumber(post.likes || 0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">
                          {formatNumber(post.comments || 0)}
                        </span>
                      </div>
                    </div>
                  )}
                  {showCaption && post.caption && (
                    <p className="text-white text-sm mt-2 px-2 text-center line-clamp-2">
                      {post.caption}
                    </p>
                  )}
                </div>
              )}
            </a>
          ))}
        </div>

        {/* Follow CTA */}
        <div className="flex justify-center mt-8">
          <Button asChild>
            <a 
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <PlatformIcon platform={platform} />
              Ver mais no {platform === 'instagram' ? 'Instagram' : platform === 'facebook' ? 'Facebook' : 'Twitter'}
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </div>

        {isEditing && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            [Configure as imagens no painel lateral ou conecte sua conta]
          </p>
        )}
      </div>
    </div>
  );
}
