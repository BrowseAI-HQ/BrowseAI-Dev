import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export function ApiKeySettings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative text-muted-foreground text-xs"
      onClick={() => user ? navigate("/dashboard#api-keys") : navigate("/dashboard")}
    >
      <Settings className="w-4 h-4" />
      <span className="hidden sm:inline ml-1">API Keys</span>
    </Button>
  );
}
