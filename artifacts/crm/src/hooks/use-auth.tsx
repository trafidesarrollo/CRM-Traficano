// @refresh reset
import { createContext, useContext, ReactNode, useCallback } from "react";
import { useLocation } from "wouter";
import { 
  useGetMe, 
  useLogin, 
  logout as logoutApi,
  User, 
  LoginRequest 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null | undefined;
  isLoading: boolean;
  login: (data: LoginRequest) => void;
  logout: () => void;
  isLoggingIn: boolean;
  isLoggingOut: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useGetMe({
    query: {
      retry: false,
      staleTime: Infinity,
    }
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData([`/api/auth/me`], data.user);
        toast({ title: "Bienvenido", description: data.message });
        setLocation("/dashboard");
      },
      onError: (error: any) => {
        toast({ 
          title: "Error de inicio de sesión", 
          description: error?.data?.error || "Credenciales inválidas",
          variant: "destructive"
        });
      }
    }
  });

  const logout = useCallback(() => {
    queryClient.setQueryData([`/api/auth/me`], null);
    queryClient.clear();
    setLocation("/login");
    logoutApi().catch(() => {});
  }, [queryClient, setLocation]);

  return (
    <AuthContext.Provider
      value={{
        user: error ? null : user,
        isLoading,
        login: (data) => loginMutation.mutate({ data }),
        logout,
        isLoggingIn: loginMutation.isPending,
        isLoggingOut: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
