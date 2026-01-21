import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// ============================================
// SUPPLIER SEARCH HOOK - OpenStreetMap/Nominatim
// ============================================

export interface SearchResult {
  id: string;
  name: string;
  displayName: string;
  address: {
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  lat: number;
  lon: number;
  category: string;
  type: string;
  phone?: string;
  website?: string;
  email?: string;
  distance?: number; // km from search location
}

export interface SearchParams {
  query: string;
  location?: string;
  radiusKm?: number;
}

interface GeocodingResult {
  lat: number;
  lon: number;
  displayName: string;
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Geocode a location string to lat/lon
async function geocodeLocation(location: string): Promise<GeocodingResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(location + ', Brasil')}&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ComandoCentral/1.0 (https://comandocentral.com.br)',
        },
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data || data.length === 0) return null;
    
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch (error) {
    console.error('[geocodeLocation] Error:', error);
    return null;
  }
}

// Extract main search term from compound queries
// e.g., "Embalagens para cosméticos" -> "Embalagens"
function extractMainTerm(query: string): string {
  // Remove common prepositions and connectors
  const stopWords = ['para', 'de', 'do', 'da', 'dos', 'das', 'em', 'com', 'e', 'ou'];
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  // Return the first significant word (usually the main business type)
  for (const word of words) {
    if (!stopWords.includes(word)) {
      return word;
    }
  }
  return words[0] || query;
}

// Search for businesses/suppliers using Nominatim
async function searchSuppliers(params: SearchParams, centerCoords?: GeocodingResult): Promise<SearchResult[]> {
  const { query, radiusKm = 50 } = params;
  
  try {
    // Extract main term for better Nominatim results
    const mainTerm = extractMainTerm(query);
    const fullQuery = query.toLowerCase();
    
    // Build the search query - search for businesses
    let searchUrl = `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(mainTerm + ' Brasil')}&format=json&limit=100&addressdetails=1&extratags=1`;
    
    // If we have center coordinates, add viewbox for better results
    if (centerCoords) {
      const latDelta = radiusKm / 111; // rough km to degrees
      const lonDelta = radiusKm / (111 * Math.cos(centerCoords.lat * Math.PI / 180));
      searchUrl += `&viewbox=${centerCoords.lon - lonDelta},${centerCoords.lat + latDelta},${centerCoords.lon + lonDelta},${centerCoords.lat - latDelta}`;
      searchUrl += `&bounded=0`; // Don't strictly bound, just prefer results in area
    }
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'ComandoCentral/1.0 (https://comandocentral.com.br)',
      },
    });
    
    if (!response.ok) throw new Error('Erro na busca');
    
    const data = await response.json();
    
    // Map results to our format, extracting all available contact info
    const results: SearchResult[] = data.map((item: any) => {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      const extratags = item.extratags || {};
      
      // Extract phone from multiple possible fields
      const phone = extratags.phone || 
                    extratags['contact:phone'] || 
                    extratags.mobile ||
                    extratags['contact:mobile'] ||
                    extratags.fax ||
                    null;
      
      // Extract website from multiple possible fields
      const website = extratags.website || 
                      extratags['contact:website'] || 
                      extratags.url ||
                      extratags['contact:url'] ||
                      null;
      
      // Extract email
      const email = extratags.email ||
                    extratags['contact:email'] ||
                    null;
      
      return {
        id: item.place_id?.toString() || `osm-${item.osm_id}`,
        name: item.name || item.display_name?.split(',')[0] || 'Sem nome',
        displayName: item.display_name,
        address: {
          road: item.address?.road,
          city: item.address?.city || item.address?.town || item.address?.municipality,
          state: item.address?.state,
          postcode: item.address?.postcode,
          country: item.address?.country,
        },
        lat,
        lon,
        category: item.class || 'place',
        type: item.type || 'business',
        phone,
        website,
        email,
        distance: centerCoords ? calculateDistance(centerCoords.lat, centerCoords.lon, lat, lon) : undefined,
      };
    });
    
    // Filter by radius if we have center coordinates
    let filteredResults = results;
    if (centerCoords) {
      filteredResults = results.filter(r => r.distance !== undefined && r.distance <= radiusKm);
      // Sort by distance
      filteredResults.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
    
    // Filter results that match the full query context (e.g., "cosméticos" for embalagens para cosméticos)
    // This helps narrow down results for compound queries
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (queryWords.length > 1) {
      // Score results based on how well they match the full query
      filteredResults = filteredResults.map(r => {
        let score = 0;
        const nameLower = r.name.toLowerCase();
        const displayLower = r.displayName.toLowerCase();
        const typeLower = (r.type || '').toLowerCase();
        const catLower = (r.category || '').toLowerCase();
        
        for (const word of queryWords) {
          if (nameLower.includes(word)) score += 3;
          if (displayLower.includes(word)) score += 1;
          if (typeLower.includes(word)) score += 2;
          if (catLower.includes(word)) score += 2;
        }
        
        return { ...r, _score: score };
      })
      .filter(r => (r as any)._score > 0) // Only keep results that match at least something
      .sort((a, b) => {
        // Sort by score first, then by distance
        const scoreDiff = ((b as any)._score || 0) - ((a as any)._score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return (a.distance || 0) - (b.distance || 0);
      })
      .map(({ _score, ...r }) => r as SearchResult);
    }
    
    // Deduplicate by name + city
    const seen = new Set<string>();
    return filteredResults.filter(r => {
      const key = `${r.name.toLowerCase()}-${r.address.city?.toLowerCase() || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (error) {
    console.error('[searchSuppliers] Error:', error);
    throw error;
  }
}

export function useSupplierSearch() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);
  const [centerCoords, setCenterCoords] = useState<GeocodingResult | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Search query
  const { data: results = [], isLoading: isSearching, error: searchError, refetch } = useQuery({
    queryKey: ['supplier-search', searchParams?.query, searchParams?.location, searchParams?.radiusKm],
    queryFn: async () => {
      if (!searchParams?.query) return [];
      
      // Geocode location if provided and not already done
      let coords = centerCoords;
      if (searchParams.location && !coords) {
        setIsGeocoding(true);
        coords = await geocodeLocation(searchParams.location);
        setCenterCoords(coords);
        setIsGeocoding(false);
      }
      
      return searchSuppliers(searchParams, coords || undefined);
    },
    enabled: !!searchParams?.query && searchParams.query.length >= 3,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  // Execute search with debounce support
  const search = useCallback((params: SearchParams) => {
    // Reset center coords if location changed
    if (params.location !== searchParams?.location) {
      setCenterCoords(null);
    }
    setSearchParams(params);
  }, [searchParams?.location]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchParams(null);
    setCenterCoords(null);
  }, []);

  // Save supplier to tenant directory
  const saveSupplier = useMutation({
    mutationFn: async (result: SearchResult) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      // Check if already saved (by external_id or name+location)
      const { data: existing } = await supabase
        .from('supplier_leads')
        .select('id')
        .eq('tenant_id', tenantId)
        .or(`name.eq.${result.name},website_url.eq.${result.website || ''}`)
        .maybeSingle();
      
      if (existing) {
        toast.info('Este fornecedor já está salvo');
        return existing;
      }
      
      // Format location
      const locationParts = [result.address.city, result.address.state].filter(Boolean);
      const location = locationParts.join(', ');
      
      // Determine category from OSM type
      let category = 'outros';
      const type = result.type?.toLowerCase() || '';
      const cat = result.category?.toLowerCase() || '';
      if (type.includes('cosmetic') || cat.includes('cosmetic')) category = 'cosmeticos';
      else if (type.includes('package') || cat.includes('industrial')) category = 'embalagens';
      else if (type.includes('transport') || type.includes('logistics')) category = 'logistica';
      
      const { data, error } = await supabase
        .from('supplier_leads')
        .insert({
          tenant_id: tenantId,
          name: result.name,
          location,
          website_url: result.website || null,
          contact_phone: result.phone || null,
          category,
          status: 'prospect',
          notes: `Endereço: ${result.displayName}\n\nFonte: OpenStreetMap`,
          tags: JSON.stringify([result.category, result.type].filter(Boolean)),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-leads', tenantId] });
      toast.success('Fornecedor salvo no seu diretório');
    },
    onError: (error) => {
      console.error('[saveSupplier] Error:', error);
      toast.error('Erro ao salvar fornecedor: ' + error.message);
    },
  });

  return {
    // Search
    search,
    clearSearch,
    results,
    isSearching: isSearching || isGeocoding,
    searchError,
    hasSearched: !!searchParams?.query,
    searchParams,
    centerCoords,
    
    // Save
    saveSupplier,
    isSaving: saveSupplier.isPending,
  };
}
