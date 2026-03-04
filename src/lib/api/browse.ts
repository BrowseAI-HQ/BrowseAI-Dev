import { supabase } from '@/integrations/supabase/client';

export type BrowseSource = {
  url: string;
  title: string;
  domain: string;
  quote: string;
};

export type BrowseClaim = {
  claim: string;
  sources: string[]; // urls
};

export type BrowseResult = {
  answer: string;
  claims: BrowseClaim[];
  sources: BrowseSource[];
  confidence: number;
  trace: {
    step: string;
    duration_ms: number;
    detail?: string;
  }[];
};

export async function browseKnowledge(query: string): Promise<BrowseResult> {
  const { data, error } = await supabase.functions.invoke('browse-knowledge', {
    body: { query },
  });

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Browse failed');
  return data.result;
}
