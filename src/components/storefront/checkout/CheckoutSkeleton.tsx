// =============================================
// CHECKOUT SKELETON
// Structural placeholder shown while the checkout
// chunk and bootstrap data are loading. Replaces the
// previous "blank screen + spinner" double-flash.
// =============================================

import { Skeleton } from '@/components/ui/skeleton';

export function CheckoutSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header placeholder */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Timeline placeholder */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-6 flex items-center justify-center gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="hidden md:block h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Main grid: form + summary */}
      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto px-4 py-8 grid lg:grid-cols-[1fr_380px] gap-8">
          {/* Form column */}
          <div className="space-y-4 bg-white rounded-lg border p-6">
            <Skeleton className="h-6 w-48" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-12 w-40 mt-4" />
          </div>

          {/* Summary column */}
          <aside className="space-y-4 bg-white rounded-lg border p-6 h-fit">
            <Skeleton className="h-5 w-32" />
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex justify-between pt-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
