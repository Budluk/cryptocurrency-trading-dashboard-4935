import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp } from "lucide-react";
import { z } from "zod";

// Validation schema for login (less strict)
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email é obrigatório")
    .email("Formato de email inválido")
    .max(255, "Email muito longo"),
  password: z
    .string()
    .min(1, "Senha é obrigatória")
    .max(72, "Senha muito longa"),
});

// Validation schema for signup (strict)
const signupSchema = z.object({
  email: z
    .string()
    .min(1, "Email é obrigatório")
    .email("Formato de email inválido")
    .max(255, "Email muito longo"),
  password: z
    .string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .max(72, "Senha muito longa")
    .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minúscula")
    .regex(/[0-9]/, "Senha deve conter pelo menos um número"),
});

export const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/');
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate input - use different schemas for login vs signup
    const schema = isSignUp ? signupSchema : loginSchema;
    const result = schema.safeParse({ email, password });
    
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((error) => {
        if (error.path[0] === "email") {
          fieldErrors.email = error.message;
        } else if (error.path[0] === "password") {
          fieldErrors.password = error.message;
        }
      });
      setErrors(fieldErrors);
      toast({
        title: "❌ Erro de validação",
        description: "Por favor, corrija os erros no formulário",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      if (isSignUp) {
        const redirectUrl = `${window.location.origin}/`;
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl
          }
        });

        if (error) {
          throw error;
        }

        // Check if email confirmation is required
        if (data?.user && !data.session) {
          toast({
            title: "✅ Conta criada!",
            description: "Verifique seu email para confirmar a conta antes de fazer login.",
          });
        } else if (data?.session) {
          toast({
            title: "✅ Conta criada e login realizado!",
            description: "Bem-vindo ao AI Trading Platform",
          });
          navigate('/');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        toast({
          title: "✅ Login realizado!",
          description: "Bem-vindo de volta ao AI Trading Platform",
        });
        
        // Navigate to home page after successful login
        navigate('/');
      }
    } catch (error: any) {
      let errorMessage = error.message;
      
      // Provide more user-friendly error messages
      if (error.message.includes("Invalid login credentials")) {
        errorMessage = "Email ou senha incorretos. Verifique suas credenciais.";
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage = "Por favor, confirme seu email antes de fazer login. Verifique sua caixa de entrada.";
      } else if (error.message.includes("User already registered")) {
        errorMessage = "Este email já está cadastrado. Tente fazer login.";
      }
      
      toast({
        title: "❌ Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <TrendingUp className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              AI Trading Platform
            </h1>
          </div>
          <CardTitle className="text-2xl">
            {isSignUp ? "Criar Conta" : "Login"}
          </CardTitle>
          <CardDescription>
            {isSignUp 
              ? "Crie sua conta para começar a operar. Você receberá um email de confirmação." 
              : "Entre com suas credenciais para continuar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                required
                disabled={loading}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                required
                disabled={loading}
                minLength={8}
                className={errors.password ? "border-destructive" : ""}
              />
              {errors.password && (
                <p className="text-sm text-destructive mt-1">{errors.password}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? "Criar Conta" : "Entrar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsSignUp(!isSignUp)}
              disabled={loading}
            >
              {isSignUp 
                ? "Já tem conta? Faça login" 
                : "Não tem conta? Cadastre-se"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
