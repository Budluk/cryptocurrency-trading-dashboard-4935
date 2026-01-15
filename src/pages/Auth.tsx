import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Auth = () => {
  const { toast } = useToast();

  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = useMemo(() => {
    if (mode === "reset") {
      return email.trim().length > 3;
    }
    return email.trim().length > 3 && password.length >= 6;
  }, [email, password, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        toast({
          title: "Conectado",
          description: "Sessão iniciada com sucesso.",
        });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        toast({
          title: "Conta criada",
          description:
            "Se a confirmação por e-mail estiver ativa, verifique sua caixa de entrada para confirmar a conta.",
        });
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });

        if (error) throw error;

        toast({
          title: "E-mail enviado",
          description: "Verifique sua caixa de entrada para redefinir a senha.",
        });
        setMode("signin");
      }
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err?.message ?? "Não foi possível processar.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <main className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {mode === "reset" ? "Recuperar senha" : "Acesso necessário"}
            </CardTitle>
            <CardDescription>
              {mode === "reset"
                ? "Digite seu e-mail para receber o link de recuperação."
                : "Para conectar e operar na conta real (Bybit), você precisa entrar com uma conta."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {mode === "reset" ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">E-mail</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={!isValid || isSubmitting}>
                  {isSubmitting ? "Enviando..." : "Enviar link de recuperação"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setMode("signin")}
                >
                  Voltar para login
                </Button>
              </form>
            ) : (
              <Tabs
                value={mode}
                onValueChange={(v) => setMode(v as "signin" | "signup")}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar conta</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@exemplo.com"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={!isValid || isSubmitting}>
                      {isSubmitting ? "Entrando..." : "Entrar"}
                    </Button>

                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-sm text-muted-foreground"
                      onClick={() => setMode("reset")}
                    >
                      Esqueci minha senha
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email2">E-mail</Label>
                      <Input
                        id="email2"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@exemplo.com"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password2">Senha</Label>
                      <Input
                        id="password2"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Crie uma senha (mín. 6 caracteres)"
                        required
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={!isValid || isSubmitting}>
                      {isSubmitting ? "Criando..." : "Criar conta"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
