import { supabase } from '@/integrations/supabase/client';

type FirecrawlResponse<T = any> = {
  success: boolean;
  error?: string;
  data?: T;
};

export const firecrawlApi = {
  async search(query: string, options?: { limit?: number }): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-search', {
      body: { query, options },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  async scrape(url: string, options?: { formats?: string[] }): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
      body: { url, options },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};
