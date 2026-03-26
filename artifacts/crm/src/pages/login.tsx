import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, isLoggingIn, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = (data: LoginForm) => {
    login(data);
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Background" 
          className="w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-3xl"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass rounded-3xl p-8 sm:p-10 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <img 
              src={`${import.meta.env.BASE_URL}images/logo.png`} 
              alt="Logo" 
              className="w-16 h-16 rounded-2xl mb-6 shadow-lg shadow-primary/20"
            />
            <h1 className="text-3xl font-display font-bold text-white text-center">Acceso al Sistema</h1>
            <p className="text-muted-foreground mt-2 text-center">CRM B2B Industrial</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input 
                id="username" 
                placeholder="admin" 
                className="bg-black/20 border-white/10 h-12 rounded-xl focus-visible:ring-primary"
                {...register("username")}
              />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input 
                id="password" 
                type="password"
                placeholder="••••••••" 
                className="bg-black/20 border-white/10 h-12 rounded-xl focus-visible:ring-primary"
                {...register("password")}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-md font-semibold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 transition-all"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Iniciando sesión..." : "Ingresar"}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
