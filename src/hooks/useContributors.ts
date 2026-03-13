import { useEffect, useState } from "react";

export interface Contributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

const CACHE_KEY = "browseai_contributors";
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export function useContributors() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setContributors(data);
          setLoading(false);
          return;
        }
      } catch {
        // ignore bad cache
      }
    }

    fetch("https://api.github.com/repos/BrowseAI-HQ/BrowseAI-Dev/contributors?per_page=50")
      .then((r) => {
        if (!r.ok) throw new Error("GitHub API error");
        return r.json();
      })
      .then((data: Contributor[]) => {
        // Filter out bots
        const humans = data.filter((c) => !c.login.includes("[bot]"));
        setContributors(humans);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: humans, ts: Date.now() }));
      })
      .catch(() => {
        // Silently fail — leaderboard just won't show
      })
      .finally(() => setLoading(false));
  }, []);

  return { contributors, loading };
}
