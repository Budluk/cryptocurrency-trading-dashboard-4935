import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Award, Users, TrendingUp, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const TraderProfileSettings = () => {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const { data: profile, refetch } = useQuery({
    queryKey: ['trader-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('trader_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const { data: followers } = useQuery({
    queryKey: ['my-followers'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('copy_trading_followers')
        .select('*')
        .eq('trader_user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setBio(profile.bio || "");
      setIsPublic(profile.is_public);
    }
  }, [profile]);

  const saveProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "❌ Não autenticado",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('trader_profiles')
        .upsert({
          user_id: user.id,
          display_name: displayName,
          bio: bio,
          is_public: isPublic,
        });

      if (error) throw error;

      toast({
        title: "✅ Perfil atualizado",
        description: isPublic ? "Seu perfil está público e pode ser seguido" : "Perfil privado",
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao atualizar perfil",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Award className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Perfil de Trader</h2>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Nome de Exibição</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome como trader"
            />
          </div>

          <div>
            <Label>Bio / Descrição</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Descreva sua estratégia e experiência..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded">
            <div>
              <Label>Perfil Público</Label>
              <p className="text-xs text-muted-foreground">
                Permitir que outros traders sigam suas operações
              </p>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>

          <Button onClick={saveProfile} className="w-full">
            Salvar Perfil
          </Button>
        </div>
      </Card>

      {profile && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Suas Estatísticas</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground">Total Trades</p>
              </div>
              <p className="text-2xl font-bold">{profile.total_trades}</p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <p className="text-xs text-muted-foreground">Win Rate</p>
              </div>
              <p className="text-2xl font-bold text-green-500">{profile.win_rate.toFixed(1)}%</p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-yellow-500" />
                <p className="text-xs text-muted-foreground">Total P&L</p>
              </div>
              <p className={`text-2xl font-bold ${profile.total_pnl > 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${profile.total_pnl.toFixed(2)}
              </p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-500" />
                <p className="text-xs text-muted-foreground">Seguidores</p>
              </div>
              <p className="text-2xl font-bold">{followers?.length || 0}</p>
            </div>
          </div>

          {profile.is_public && (
            <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm font-semibold text-primary mb-2">
                🎯 Perfil Público Ativo
              </p>
              <p className="text-xs text-muted-foreground">
                Seus trades estão sendo compartilhados automaticamente com seus {followers?.length || 0} seguidores ativos.
                Mantenha uma boa performance para atrair mais seguidores!
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
