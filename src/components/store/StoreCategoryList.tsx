import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
}

interface StoreCategoryListProps {
  tenantId: string;
  tenantSlug: string;
}

export function StoreCategoryList({ tenantId, tenantSlug }: StoreCategoryListProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, description, image_url")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("sort_order");

      if (!error && data) {
        setCategories(data);
      }
      setLoading(false);
    };

    fetchCategories();
  }, [tenantId]);

  if (loading) {
    return (
      <section className="py-8">
        <h2 className="text-xl font-bold mb-4">Categorias</h2>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-40 flex-shrink-0 rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="py-8">
      <h2 className="text-xl font-bold mb-4">Categorias</h2>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {categories.map((category) => (
          <Link
            key={category.id}
            to={`/store/${tenantSlug}/category/${category.slug}`}
            className="group flex-shrink-0"
          >
            <div className="relative h-24 w-40 rounded-lg overflow-hidden bg-muted border transition-all hover:shadow-md hover:border-primary">
              {category.image_url ? (
                <img
                  src={category.image_url}
                  alt={category.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div 
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.7) 100%)' }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <span className="text-sm font-medium text-white flex items-center gap-1">
                  {category.name}
                  <ChevronRight className="h-4 w-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
