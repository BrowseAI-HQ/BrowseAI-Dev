import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-muted">
      <nav className="flex items-center gap-4 px-4 sm:px-8 py-5 border-b border-border">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <img src="/logo.svg" alt="BrowseAI Dev" className="w-4 h-4" />
          <span className="font-semibold text-sm">BrowseAI Dev</span>
        </div>
      </nav>
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            Return to Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
