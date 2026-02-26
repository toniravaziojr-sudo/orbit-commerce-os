import { useState } from "react";
import { cn } from "@/lib/utils";
import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmailPreviewProps {
  html: string;
}

export function EmailPreview({ html }: EmailPreviewProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="flex items-center gap-2">
        <Button
          variant={device === "desktop" ? "default" : "outline"}
          size="sm"
          onClick={() => setDevice("desktop")}
          className="gap-1.5"
        >
          <Monitor className="h-4 w-4" /> Desktop
        </Button>
        <Button
          variant={device === "mobile" ? "default" : "outline"}
          size="sm"
          onClick={() => setDevice("mobile")}
          className="gap-1.5"
        >
          <Smartphone className="h-4 w-4" /> Mobile
        </Button>
      </div>

      <div
        className={cn(
          "border rounded-lg overflow-hidden bg-muted/30 shadow-inner transition-all mx-auto",
          device === "desktop" ? "w-full max-w-[680px]" : "w-[375px]"
        )}
      >
        <iframe
          srcDoc={html}
          title="Email Preview"
          className="w-full border-0"
          style={{ height: "500px" }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
