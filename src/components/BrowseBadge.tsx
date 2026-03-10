import { useNavigate } from "react-router-dom";
import { BrowseLogo } from "./BrowseLogo";

export function BrowseBadge() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/")}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-accent/40 transition-all"
    >
      <BrowseLogo className="w-3 h-3" />
      Powered by BrowseAI Dev
    </button>
  );
}
