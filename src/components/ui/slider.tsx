import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  /** Use theme accent color instead of primary - applies to storefront context */
  useAccentColor?: boolean;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, useAccentColor = false, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderPrimitive.Range 
        className={cn(
          "absolute h-full",
          useAccentColor ? "sf-accent-bg" : "bg-primary"
        )} 
        style={useAccentColor ? { backgroundColor: 'var(--theme-accent-color, var(--primary))' } : undefined}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb 
      className={cn(
        "block h-5 w-5 rounded-full bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        useAccentColor ? "border-2 sf-accent-border" : "border-2 border-primary"
      )} 
      style={useAccentColor ? { borderColor: 'var(--theme-accent-color, var(--primary))' } : undefined}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
