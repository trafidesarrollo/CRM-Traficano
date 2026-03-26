import { createContext, useContext, ReactNode } from "react";
import { useLocation } from "wouter";
import { 
  useGetMe, 
  useLogin, 
  useLogout, 
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

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData([`/api/auth/me`], null);
        queryClient.clear();
        setLocation("/login");
      }
    }
  });

  return (
    <AuthContext.Provider
      value={{
        user: error ? null : user,
        isLoading,
        login: (data) => loginMutation.mutate({ data }),
        logout: () => logoutMutation.mutate(),
        isLoggingIn: loginMutation.isPending,
        isLoggingOut: logoutMutation.isPending,
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
