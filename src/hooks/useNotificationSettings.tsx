import { useState, useEffect } from 'react';

export interface NotificationSettings {
  minOrderValue: number;
  enabledSymbols: string[];
  startHour: number;
  endHour: number;
  onlyInstitutional: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  minOrderValue: 500000, // $500k
  enabledSymbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'],
  startHour: 0,
  endHour: 23,
  onlyInstitutional: true,
};

const STORAGE_KEY = 'orderflow_notification_settings';

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const shouldNotify = (
    orderValue: number,
    symbol: string,
    isInstitutional: boolean
  ): boolean => {
    // Check minimum value
    if (orderValue < settings.minOrderValue) return false;

    // Check if symbol is enabled
    if (!settings.enabledSymbols.includes(symbol)) return false;

    // Check if only institutional and order is not institutional
    if (settings.onlyInstitutional && !isInstitutional) return false;

    // Check time window
    const currentHour = new Date().getHours();
    if (settings.startHour <= settings.endHour) {
      // Normal range (e.g., 9-17)
      if (currentHour < settings.startHour || currentHour > settings.endHour) {
        return false;
      }
    } else {
      // Overnight range (e.g., 22-6)
      if (currentHour < settings.startHour && currentHour > settings.endHour) {
        return false;
      }
    }

    return true;
  };

  return {
    settings,
    updateSettings,
    resetSettings,
    shouldNotify,
  };
}
