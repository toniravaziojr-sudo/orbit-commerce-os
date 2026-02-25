import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronRight, Loader2, FolderOpen, X, ArrowLeft, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MeliCategory {
  id: string;
  name: string;
  domain_name?: string;
  children_count?: number;
  total_items?: number;
  results?: number;
}

interface PathItem {
  id: string;
  name: string;
}

interface MeliCategoryPickerProps {
  value: string;
  onChange: (categoryId: string, categoryName?: string) => void;
  selectedName?: string;
  productName?: string;
  productDescription?: string;
}

export function MeliCategoryPicker({ value, onChange, selectedName, productName, productDescription }: MeliCategoryPickerProps) {
  const { currentTenant } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<MeliCategory[]>([]);
  const [path, setPath] = useState<PathItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [displayName, setDisplayName] = useState(selectedName || "");
  const [isAutoSuggesting, setIsAutoSuggesting] = useState(false);

  const fetchCategories = useCallback(async (params: Record<string, string>) => {
    setIsLoading(true);
    try {
      const { data } = await supabase.functions.invoke("meli-search-categories", {
        body: { ...params, tenantId: currentTenant?.id },
      });
      
      if (data?.success) {
        setCategories(data.categories || []);
        if (data.path) setPath(data.path);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setPath([]);
    fetchCategories({ q: searchQuery.trim() });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleOpenBrowser = () => {
    setIsOpen(true);
    if (categories.length === 0) {
      fetchCategories({});
    }
  };

  const handleSelectCategory = (cat: MeliCategory) => {
    // If it has children, browse into it
    if (cat.children_count && cat.children_count > 0) {
      fetchCategories({ parentId: cat.id });
      return;
    }
    // Select this category
    onChange(cat.id, cat.name);
    setDisplayName(cat.name);
    setIsOpen(false);
    setCategories([]);
    setPath([]);
    setSearchQuery("");
  };

  const handleBrowseInto = (catId: string) => {
    fetchCategories({ parentId: catId });
  };

  const handleClear = () => {
    onChange("", "");
    setDisplayName("");
  };

  const handleAutoSuggest = async () => {
    const name = productName;
    if (!name?.trim() || !currentTenant?.id) return;
    setIsAutoSuggesting(true);
    try {
      const { data } = await supabase.functions.invoke("meli-bulk-operations", {
        body: { tenantId: currentTenant.id, action: "auto_suggest_category", productName: name, productDescription: productDescription || "" },
      });
      if (data?.success && data.categoryId) {
        onChange(data.categoryId, data.categoryName);
        setDisplayName(data.path || data.categoryName);
    } else {
      toast.error("Não foi possível identificar a categoria automaticamente", {
        description: "Tente buscar manualmente pelo nome do produto.",
      });
      handleOpenBrowser();
    }
    } catch {
      handleOpenBrowser();
    } finally {
      setIsAutoSuggesting(false);
    }
  };

  const handleBack = () => {
    if (path.length > 1) {
      const parentId = path[path.length - 2].id;
      fetchCategories({ parentId });
    } else {
      setPath([]);
      fetchCategories({});
    }
  };

  if (!isOpen) {
    return (
      <div className="space-y-2">
        {value ? (
          <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName || value}</p>
              <p className="text-xs text-muted-foreground">{value}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClear}>
              <X className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleOpenBrowser}>
              Trocar
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 justify-start text-muted-foreground" onClick={handleOpenBrowser}>
              <Search className="h-4 w-4 mr-2" />
              Buscar categoria do Mercado Livre...
            </Button>
            {productName && (
              <Button
                variant="secondary"
                onClick={handleAutoSuggest}
                disabled={isAutoSuggesting}
                className="gap-1.5 shrink-0"
              >
                {isAutoSuggesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Auto
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 border rounded-lg p-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar categoria... ex: celular, camiseta"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-10"
            autoFocus
          />
        </div>
        <Button size="sm" onClick={handleSearch} disabled={isLoading || !searchQuery.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setIsOpen(false); setSearchQuery(""); setCategories([]); setPath([]); }}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Breadcrumb path */}
      {path.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleBack}>
            <ArrowLeft className="h-3 w-3" />
          </Button>
          {path.map((p, i) => (
            <div key={p.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => handleBrowseInto(p.id)}
              >
                {p.name}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Category list */}
      <ScrollArea className="h-[250px] border rounded-md">
        <div className="p-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              {searchQuery ? "Nenhuma categoria encontrada" : "Digite para buscar categorias"}
            </div>
          ) : (
            <div className="space-y-0.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className="w-full flex items-center gap-2 p-2.5 rounded hover:bg-muted/50 text-left transition-colors group"
                  onClick={() => handleSelectCategory(cat)}
                >
                  <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cat.name}</p>
                    {cat.domain_name && (
                      <p className="text-xs text-muted-foreground truncate">{cat.domain_name}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{cat.id}</Badge>
                  {(cat.children_count && cat.children_count > 0) ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <p className="text-xs text-muted-foreground">
        Selecione a categoria mais específica possível para o seu produto.
      </p>
    </div>
  );
}
