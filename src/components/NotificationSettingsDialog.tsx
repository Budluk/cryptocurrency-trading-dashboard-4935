import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Settings, RotateCcw } from "lucide-react";
import { NotificationSettings } from "@/hooks/useNotificationSettings";
import { Badge } from "@/components/ui/badge";

interface NotificationSettingsDialogProps {
  settings: NotificationSettings;
  onUpdateSettings: (settings: Partial<NotificationSettings>) => void;
  onResetSettings: () => void;
}

const AVAILABLE_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT'];

export function NotificationSettingsDialog({
  settings,
  onUpdateSettings,
  onResetSettings,
}: NotificationSettingsDialogProps) {
  const [open, setOpen] = useState(false);

  const toggleSymbol = (symbol: string) => {
    const newSymbols = settings.enabledSymbols.includes(symbol)
      ? settings.enabledSymbols.filter(s => s !== symbol)
      : [...settings.enabledSymbols, symbol];
    onUpdateSettings({ enabledSymbols: newSymbols });
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Filtros
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações de Notificações</DialogTitle>
          <DialogDescription>
            Configure quando e quais ordens devem gerar notificações
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Minimum Order Value */}
          <div className="space-y-2">
            <Label>Valor Mínimo da Ordem</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={settings.minOrderValue}
                onChange={(e) =>
                  onUpdateSettings({ minOrderValue: Number(e.target.value) })
                }
                min={100000}
                step={100000}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground min-w-[60px]">
                {formatCurrency(settings.minOrderValue)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Notificar apenas ordens acima deste valor
            </p>
          </div>

          {/* Trading Hours */}
          <div className="space-y-3">
            <Label>Horário de Funcionamento</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Início</Label>
                <Input
                  type="number"
                  value={settings.startHour}
                  onChange={(e) =>
                    onUpdateSettings({ startHour: Number(e.target.value) })
                  }
                  min={0}
                  max={23}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fim</Label>
                <Input
                  type="number"
                  value={settings.endHour}
                  onChange={(e) =>
                    onUpdateSettings({ endHour: Number(e.target.value) })
                  }
                  min={0}
                  max={23}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Receber notificações apenas entre {settings.startHour}h e {settings.endHour}h
            </p>
          </div>

          {/* Enabled Symbols */}
          <div className="space-y-3">
            <Label>Símbolos Habilitados</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SYMBOLS.map((symbol) => (
                <Badge
                  key={symbol}
                  variant={settings.enabledSymbols.includes(symbol) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleSymbol(symbol)}
                >
                  {symbol}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {settings.enabledSymbols.length} símbolo(s) selecionado(s)
            </p>
          </div>

          {/* Only Institutional */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Apenas Ordens Institucionais</Label>
              <p className="text-xs text-muted-foreground">
                Notificar apenas ordens acima de $500K
              </p>
            </div>
            <Switch
              checked={settings.onlyInstitutional}
              onCheckedChange={(checked) =>
                onUpdateSettings({ onlyInstitutional: checked })
              }
            />
          </div>

          {/* Reset Button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              onResetSettings();
              setOpen(false);
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar Padrão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
