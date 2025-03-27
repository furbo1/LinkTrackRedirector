import { useAuth } from "@/components/auth/AuthContext";
import { Redirect, Route } from "wouter";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: React.ComponentType;
}) {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Route path={path}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : isAuthenticated ? (
        <Component />
      ) : (
        <Redirect to="/auth" />
      )}
    </Route>
  );
}