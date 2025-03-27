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
  const { isAuthenticated } = useAuth();

  return (
    <Route path={path}>
      {isAuthenticated ? <Component /> : <Redirect to="/auth" />}
    </Route>
  );
}