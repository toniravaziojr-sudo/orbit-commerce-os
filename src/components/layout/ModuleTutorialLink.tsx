// =============================================
// MODULE TUTORIAL LINK COMPONENT
// Shows "Veja tutorial deste módulo" with video popup
// =============================================

import { useState } from "react";
import { PlayCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useModuleTutorial } from "@/hooks/useModuleTutorials";

export function ModuleTutorialLink() {
  const { data: tutorial, isLoading } = useModuleTutorial();
  const [isOpen, setIsOpen] = useState(false);
  
  if (isLoading || !tutorial) {
    return null;
  }
  
  // Extract video ID for embed (supports YouTube and Vimeo)
  const getEmbedUrl = (url: string): string => {
    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`;
    }
    
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    }
    
    // Loom
    const loomMatch = url.match(/loom\.com\/share\/([^?]+)/);
    if (loomMatch) {
      return `https://www.loom.com/embed/${loomMatch[1]}?autoplay=1`;
    }
    
    // Return original URL if no match
    return url;
  };
  
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 h-8 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
        onClick={() => setIsOpen(true)}
      >
        <PlayCircle className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Veja tutorial deste módulo</span>
        <span className="md:hidden">Tutorial</span>
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-lg">{tutorial.title}</DialogTitle>
            {tutorial.description && (
              <DialogDescription>{tutorial.description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="relative w-full aspect-video bg-black">
            <iframe
              src={getEmbedUrl(tutorial.video_url)}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
