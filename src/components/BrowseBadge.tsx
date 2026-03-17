import { useNavigate } from "react-router-dom";
import { BrowseLogo } from "./BrowseLogo";

export function BrowseBadge() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-accent/40 transition-all"
      >
        <BrowseLogo className="w-3 h-3" />
        Powered by BrowseAI Dev
      </button>
      <p className="text-[10px] text-muted-foreground/50 max-w-sm text-center">
        AI-generated research for informational purposes only. Not financial, medical, or legal advice.{" "}
        <span className="underline cursor-pointer hover:text-muted-foreground/70" onClick={() => navigate("/terms")}>
          Terms
        </span>
      </p>
    </div>
  );
}
