export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      ai_market_signals: {
        Row: {
          action: string
          confidence_score: number
          created_at: string
          currency_pair: string
          data_sources: Json
          expires_at: string | null
          id: string
          price_target: number | null
          reasoning: Json
          signal_type: string
          stop_loss: number | null
          take_profit: number | null
          timeframe: string
        }
        Insert: {
          action: string
          confidence_score: number
          created_at?: string
          currency_pair?: string
          data_sources: Json
          expires_at?: string | null
          id?: string
          price_target?: number | null
          reasoning: Json
          signal_type: string
          stop_loss?: number | null
          take_profit?: number | null
          timeframe: string
        }
        Update: {
          action?: string
          confidence_score?: number
          created_at?: string
          currency_pair?: string
          data_sources?: Json
          expires_at?: string | null
          id?: string
          price_target?: number | null
          reasoning?: Json
          signal_type?: string
          stop_loss?: number | null
          take_profit?: number | null
          timeframe?: string
        }
        Relationships: []
      }
      auto_trader_config: {
        Row: {
          allowed_symbols: string[] | null
          created_at: string
          email_notifications: boolean
          excluded_symbols: string[] | null
          id: string
          is_active: boolean
          max_position_size: number
          max_simultaneous_positions: number
          min_confidence: number
          notifications_enabled: boolean
          operating_hours_end: number | null
          operating_hours_start: number | null
          risk_per_trade_percentage: number
          timeframes: string[] | null
          trailing_stop_percentage: number | null
          updated_at: string
          use_stop_loss: boolean
          use_take_profit: boolean
          user_id: string
        }
        Insert: {
          allowed_symbols?: string[] | null
          created_at?: string
          email_notifications?: boolean
          excluded_symbols?: string[] | null
          id?: string
          is_active?: boolean
          max_position_size?: number
          max_simultaneous_positions?: number
          min_confidence?: number
          notifications_enabled?: boolean
          operating_hours_end?: number | null
          operating_hours_start?: number | null
          risk_per_trade_percentage?: number
          timeframes?: string[] | null
          trailing_stop_percentage?: number | null
          updated_at?: string
          use_stop_loss?: boolean
          use_take_profit?: boolean
          user_id: string
        }
        Update: {
          allowed_symbols?: string[] | null
          created_at?: string
          email_notifications?: boolean
          excluded_symbols?: string[] | null
          id?: string
          is_active?: boolean
          max_position_size?: number
          max_simultaneous_positions?: number
          min_confidence?: number
          notifications_enabled?: boolean
          operating_hours_end?: number | null
          operating_hours_start?: number | null
          risk_per_trade_percentage?: number
          timeframes?: string[] | null
          trailing_stop_percentage?: number | null
          updated_at?: string
          use_stop_loss?: boolean
          use_take_profit?: boolean
          user_id?: string
        }
        Relationships: []
      }
      auto_trader_logs: {
        Row: {
          created_at: string
          id: string
          log_type: string
          message: string
          metadata: Json | null
          position_id: string | null
          symbol: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          log_type: string
          message: string
          metadata?: Json | null
          position_id?: string | null
          symbol?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          log_type?: string
          message?: string
          metadata?: Json | null
          position_id?: string | null
          symbol?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_trader_logs_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "auto_trader_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_trader_positions: {
        Row: {
          action: string
          close_reason: string | null
          closed_at: string | null
          confidence: number
          config_id: string | null
          created_at: string
          current_price: number | null
          entry_price: number
          exchange_order_id: string | null
          id: string
          opened_at: string
          quantity: number
          realized_pnl: number | null
          reasoning: string | null
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          unrealized_pnl: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          close_reason?: string | null
          closed_at?: string | null
          confidence: number
          config_id?: string | null
          created_at?: string
          current_price?: number | null
          entry_price: number
          exchange_order_id?: string | null
          id?: string
          opened_at?: string
          quantity: number
          realized_pnl?: number | null
          reasoning?: string | null
          status?: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          unrealized_pnl?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          close_reason?: string | null
          closed_at?: string | null
          confidence?: number
          config_id?: string | null
          created_at?: string
          current_price?: number | null
          entry_price?: number
          exchange_order_id?: string | null
          id?: string
          opened_at?: string
          quantity?: number
          realized_pnl?: number | null
          reasoning?: string | null
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          unrealized_pnl?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_trader_positions_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "auto_trader_config"
            referencedColumns: ["id"]
          },
        ]
      }
      backtesting_results: {
        Row: {
          config_snapshot: Json
          created_at: string
          end_date: string
          id: string
          losing_trades: number
          max_drawdown: number
          profit_factor: number
          sharpe_ratio: number | null
          start_date: string
          total_pnl: number
          total_trades: number
          trades_data: Json | null
          user_id: string
          win_rate: number
          winning_trades: number
        }
        Insert: {
          config_snapshot: Json
          created_at?: string
          end_date: string
          id?: string
          losing_trades?: number
          max_drawdown?: number
          profit_factor?: number
          sharpe_ratio?: number | null
          start_date: string
          total_pnl?: number
          total_trades?: number
          trades_data?: Json | null
          user_id: string
          win_rate?: number
          winning_trades?: number
        }
        Update: {
          config_snapshot?: Json
          created_at?: string
          end_date?: string
          id?: string
          losing_trades?: number
          max_drawdown?: number
          profit_factor?: number
          sharpe_ratio?: number | null
          start_date?: string
          total_pnl?: number
          total_trades?: number
          trades_data?: Json | null
          user_id?: string
          win_rate?: number
          winning_trades?: number
        }
        Relationships: []
      }
      demo_accounts: {
        Row: {
          created_at: string
          current_balance: number
          id: string
          initial_balance: number
          total_pnl: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          total_pnl?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          total_pnl?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      demo_positions: {
        Row: {
          close_reason: string | null
          closed_at: string | null
          current_price: number | null
          demo_account_id: string
          entry_price: number
          id: string
          opened_at: string
          pnl: number | null
          quantity: number
          side: string
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          user_id: string
        }
        Insert: {
          close_reason?: string | null
          closed_at?: string | null
          current_price?: number | null
          demo_account_id: string
          entry_price: number
          id?: string
          opened_at?: string
          pnl?: number | null
          quantity: number
          side: string
          status?: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          user_id: string
        }
        Update: {
          close_reason?: string | null
          closed_at?: string | null
          current_price?: number | null
          demo_account_id?: string
          entry_price?: number
          id?: string
          opened_at?: string
          pnl?: number | null
          quantity?: number
          side?: string
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_positions_demo_account_id_fkey"
            columns: ["demo_account_id"]
            isOneToOne: false
            referencedRelation: "demo_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_trades: {
        Row: {
          created_at: string
          demo_account_id: string
          entry_price: number
          exit_price: number
          id: string
          pnl: number
          quantity: number
          side: string
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          demo_account_id: string
          entry_price: number
          exit_price: number
          id?: string
          pnl: number
          quantity: number
          side: string
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          demo_account_id?: string
          entry_price?: number
          exit_price?: number
          id?: string
          pnl?: number
          quantity?: number
          side?: string
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_trades_demo_account_id_fkey"
            columns: ["demo_account_id"]
            isOneToOne: false
            referencedRelation: "demo_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      image_analysis: {
        Row: {
          analysis_result: Json
          confidence_score: number | null
          created_at: string
          description: string | null
          id: string
          image_type: string
          image_url: string
          impact_score: number | null
          location: string | null
          market_signal: string | null
          processed_at: string
        }
        Insert: {
          analysis_result: Json
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_type: string
          image_url: string
          impact_score?: number | null
          location?: string | null
          market_signal?: string | null
          processed_at?: string
        }
        Update: {
          analysis_result?: Json
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_type?: string
          image_url?: string
          impact_score?: number | null
          location?: string | null
          market_signal?: string | null
          processed_at?: string
        }
        Relationships: []
      }
      logs: {
        Row: {
          asset_interval: string | null
          asset_symbol: string | null
          id: string
          message: string
          timestamp: string
          type: string
          user_id: string | null
        }
        Insert: {
          asset_interval?: string | null
          asset_symbol?: string | null
          id?: string
          message: string
          timestamp?: string
          type: string
          user_id?: string | null
        }
        Update: {
          asset_interval?: string | null
          asset_symbol?: string | null
          id?: string
          message?: string
          timestamp?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      market_data: {
        Row: {
          close_price: number
          created_at: string | null
          high_price: number
          id: string
          low_price: number
          open_price: number
          symbol: string
          timeframe: string
          timestamp: string
          volume: number
        }
        Insert: {
          close_price: number
          created_at?: string | null
          high_price: number
          id?: string
          low_price: number
          open_price: number
          symbol: string
          timeframe: string
          timestamp: string
          volume: number
        }
        Update: {
          close_price?: number
          created_at?: string | null
          high_price?: number
          id?: string
          low_price?: number
          open_price?: number
          symbol?: string
          timeframe?: string
          timestamp?: string
          volume?: number
        }
        Relationships: []
      }
      market_events: {
        Row: {
          actual_value: number | null
          country: string
          created_at: string
          currency_impact: string
          description: string | null
          event_type: string
          forecast_value: number | null
          id: string
          importance: string
          market_reaction: Json | null
          previous_value: number | null
          scheduled_at: string
          title: string
        }
        Insert: {
          actual_value?: number | null
          country?: string
          created_at?: string
          currency_impact?: string
          description?: string | null
          event_type: string
          forecast_value?: number | null
          id?: string
          importance: string
          market_reaction?: Json | null
          previous_value?: number | null
          scheduled_at: string
          title: string
        }
        Update: {
          actual_value?: number | null
          country?: string
          created_at?: string
          currency_impact?: string
          description?: string | null
          event_type?: string
          forecast_value?: number | null
          id?: string
          importance?: string
          market_reaction?: Json | null
          previous_value?: number | null
          scheduled_at?: string
          title?: string
        }
        Relationships: []
      }
      news_analysis: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          impact_score: number | null
          keywords: string[] | null
          market_impact: Json | null
          processed_at: string
          published_at: string
          sentiment_score: number | null
          source: string
          title: string
          url: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          impact_score?: number | null
          keywords?: string[] | null
          market_impact?: Json | null
          processed_at?: string
          published_at: string
          sentiment_score?: number | null
          source: string
          title: string
          url?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          impact_score?: number | null
          keywords?: string[] | null
          market_impact?: Json | null
          processed_at?: string
          published_at?: string
          sentiment_score?: number | null
          source?: string
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      paper_trades: {
        Row: {
          action: string
          close_reason: string | null
          closed_at: string | null
          current_price: number | null
          demo_account_id: string
          entry_price: number
          fees: number | null
          id: string
          notes: string | null
          opened_at: string
          quantity: number
          realized_pnl: number | null
          signal_id: string | null
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          unrealized_pnl: number | null
          user_id: string
        }
        Insert: {
          action: string
          close_reason?: string | null
          closed_at?: string | null
          current_price?: number | null
          demo_account_id: string
          entry_price: number
          fees?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          quantity: number
          realized_pnl?: number | null
          signal_id?: string | null
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          unrealized_pnl?: number | null
          user_id: string
        }
        Update: {
          action?: string
          close_reason?: string | null
          closed_at?: string | null
          current_price?: number | null
          demo_account_id?: string
          entry_price?: number
          fees?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          quantity?: number
          realized_pnl?: number | null
          signal_id?: string | null
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          unrealized_pnl?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_trades_demo_account_id_fkey"
            columns: ["demo_account_id"]
            isOneToOne: false
            referencedRelation: "demo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paper_trades_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signal_history"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      risk_management: {
        Row: {
          created_at: string | null
          current_daily_loss: number | null
          daily_loss_limit: number
          id: string
          is_active: boolean | null
          last_reset_date: string | null
          max_position_size: number
          risk_per_trade: number
          strategy_id: string | null
          updated_at: string | null
          volatility_threshold: number
        }
        Insert: {
          created_at?: string | null
          current_daily_loss?: number | null
          daily_loss_limit: number
          id?: string
          is_active?: boolean | null
          last_reset_date?: string | null
          max_position_size: number
          risk_per_trade: number
          strategy_id?: string | null
          updated_at?: string | null
          volatility_threshold: number
        }
        Update: {
          created_at?: string | null
          current_daily_loss?: number | null
          daily_loss_limit?: number
          id?: string
          is_active?: boolean | null
          last_reset_date?: string | null
          max_position_size?: number
          risk_per_trade?: number
          strategy_id?: string | null
          updated_at?: string | null
          volatility_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "risk_management_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "trading_strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_history: {
        Row: {
          action: string
          actual_outcome: string | null
          closed_at: string | null
          confidence: number
          created_at: string
          duration_minutes: number | null
          entry_price: number
          exit_price: number | null
          id: string
          pnl_percentage: number | null
          reasoning: string | null
          signal_type: string
          status: string
          stop_loss: number | null
          symbol: string
          target_price: number | null
          timeframe: string
          user_id: string | null
        }
        Insert: {
          action: string
          actual_outcome?: string | null
          closed_at?: string | null
          confidence: number
          created_at?: string
          duration_minutes?: number | null
          entry_price: number
          exit_price?: number | null
          id?: string
          pnl_percentage?: number | null
          reasoning?: string | null
          signal_type: string
          status?: string
          stop_loss?: number | null
          symbol?: string
          target_price?: number | null
          timeframe: string
          user_id?: string | null
        }
        Update: {
          action?: string
          actual_outcome?: string | null
          closed_at?: string | null
          confidence?: number
          created_at?: string
          duration_minutes?: number | null
          entry_price?: number
          exit_price?: number | null
          id?: string
          pnl_percentage?: number | null
          reasoning?: string | null
          signal_type?: string
          status?: string
          stop_loss?: number | null
          symbol?: string
          target_price?: number | null
          timeframe?: string
          user_id?: string | null
        }
        Relationships: []
      }
      strategies: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parameters: Json | null
          stop_loss_atr_multiplier: number | null
          take_profit_rr: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parameters?: Json | null
          stop_loss_atr_multiplier?: number | null
          take_profit_rr?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parameters?: Json | null
          stop_loss_atr_multiplier?: number | null
          take_profit_rr?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      strategy_configs: {
        Row: {
          created_at: string
          cvd_threshold_buy: number
          cvd_threshold_sell: number
          enable_alerts: boolean
          enable_sound: boolean
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
          vwap_periods: number
        }
        Insert: {
          created_at?: string
          cvd_threshold_buy?: number
          cvd_threshold_sell?: number
          enable_alerts?: boolean
          enable_sound?: boolean
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
          vwap_periods?: number
        }
        Update: {
          created_at?: string
          cvd_threshold_buy?: number
          cvd_threshold_sell?: number
          enable_alerts?: boolean
          enable_sound?: boolean
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
          vwap_periods?: number
        }
        Relationships: []
      }
      strategy_performance: {
        Row: {
          id: string
          last_updated_at: string
          strategy_id: string
          total_pnl: number
          total_trades: number
          user_id: string | null
          winning_trades: number
        }
        Insert: {
          id?: string
          last_updated_at?: string
          strategy_id: string
          total_pnl?: number
          total_trades?: number
          user_id?: string | null
          winning_trades?: number
        }
        Update: {
          id?: string
          last_updated_at?: string
          strategy_id?: string
          total_pnl?: number
          total_trades?: number
          user_id?: string | null
          winning_trades?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategy_performance_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: true
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          exchange_order_id: string | null
          exit_price: number | null
          id: string
          pnl: number | null
          price: number
          quantity: number
          status: string
          strategy_id: string | null
          symbol: string
          timestamp: string | null
          trade_type: string
        }
        Insert: {
          exchange_order_id?: string | null
          exit_price?: number | null
          id?: string
          pnl?: number | null
          price: number
          quantity: number
          status: string
          strategy_id?: string | null
          symbol: string
          timestamp?: string | null
          trade_type: string
        }
        Update: {
          exchange_order_id?: string | null
          exit_price?: number | null
          id?: string
          pnl?: number | null
          price?: number
          quantity?: number
          status?: string
          strategy_id?: string | null
          symbol?: string
          timestamp?: string | null
          trade_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_alerts: {
        Row: {
          confidence: number | null
          created_at: string
          cvd: number
          id: string
          is_read: boolean
          message: string | null
          price: number
          signal_type: string
          user_id: string
          vwap: number
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          cvd: number
          id?: string
          is_read?: boolean
          message?: string | null
          price: number
          signal_type: string
          user_id: string
          vwap: number
        }
        Update: {
          confidence?: number | null
          created_at?: string
          cvd?: number
          id?: string
          is_read?: boolean
          message?: string | null
          price?: number
          signal_type?: string
          user_id?: string
          vwap?: number
        }
        Relationships: []
      }
      trading_alerts_config: {
        Row: {
          alert_type: string
          conditions: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          notifications: Json
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          conditions: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notifications?: Json
          symbol?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notifications?: Json
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_logs: {
        Row: {
          context: Json | null
          id: string
          level: string
          message: string
          strategy_id: string | null
          timestamp: string | null
        }
        Insert: {
          context?: Json | null
          id?: string
          level: string
          message: string
          strategy_id?: string | null
          timestamp?: string | null
        }
        Update: {
          context?: Json | null
          id?: string
          level?: string
          message?: string
          strategy_id?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trading_logs_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "trading_strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_performance: {
        Row: {
          avg_loss: number
          avg_trade_duration: number | null
          avg_win: number
          created_at: string
          id: string
          largest_loss: number
          largest_win: number
          losing_trades: number
          max_drawdown: number
          period_end: string
          period_start: string
          profit_factor: number
          sharpe_ratio: number | null
          total_pnl: number
          total_trades: number
          updated_at: string
          user_id: string
          win_rate: number
          winning_trades: number
        }
        Insert: {
          avg_loss?: number
          avg_trade_duration?: number | null
          avg_win?: number
          created_at?: string
          id?: string
          largest_loss?: number
          largest_win?: number
          losing_trades?: number
          max_drawdown?: number
          period_end: string
          period_start: string
          profit_factor?: number
          sharpe_ratio?: number | null
          total_pnl?: number
          total_trades?: number
          updated_at?: string
          user_id: string
          win_rate?: number
          winning_trades?: number
        }
        Update: {
          avg_loss?: number
          avg_trade_duration?: number | null
          avg_win?: number
          created_at?: string
          id?: string
          largest_loss?: number
          largest_win?: number
          losing_trades?: number
          max_drawdown?: number
          period_end?: string
          period_start?: string
          profit_factor?: number
          sharpe_ratio?: number | null
          total_pnl?: number
          total_trades?: number
          updated_at?: string
          user_id?: string
          win_rate?: number
          winning_trades?: number
        }
        Relationships: []
      }
      trading_positions: {
        Row: {
          closed_at: string | null
          entry_price: number
          exchange_order_id: string | null
          exit_price: number | null
          id: string
          opened_at: string | null
          pnl: number | null
          quantity: number
          side: string
          status: string
          stop_loss: number | null
          strategy_id: string | null
          symbol: string
          take_profit: number | null
        }
        Insert: {
          closed_at?: string | null
          entry_price: number
          exchange_order_id?: string | null
          exit_price?: number | null
          id?: string
          opened_at?: string | null
          pnl?: number | null
          quantity: number
          side: string
          status?: string
          stop_loss?: number | null
          strategy_id?: string | null
          symbol: string
          take_profit?: number | null
        }
        Update: {
          closed_at?: string | null
          entry_price?: number
          exchange_order_id?: string | null
          exit_price?: number | null
          id?: string
          opened_at?: string | null
          pnl?: number | null
          quantity?: number
          side?: string
          status?: string
          stop_loss?: number | null
          strategy_id?: string | null
          symbol?: string
          take_profit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trading_positions_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "trading_strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_signals: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          indicators: Json | null
          market_regime: string | null
          price: number
          signal_type: string
          strategy_id: string | null
          symbol: string
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          indicators?: Json | null
          market_regime?: string | null
          price: number
          signal_type: string
          strategy_id?: string | null
          symbol: string
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          indicators?: Json | null
          market_regime?: string | null
          price?: number
          signal_type?: string
          strategy_id?: string | null
          symbol?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trading_signals_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "trading_strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_strategies: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parameters: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parameters?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parameters?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      triggered_alerts: {
        Row: {
          action_taken: string | null
          alert_config_id: string
          id: string
          is_read: boolean
          message: string
          trigger_data: Json
          triggered_at: string
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          alert_config_id: string
          id?: string
          is_read?: boolean
          message: string
          trigger_data: Json
          triggered_at?: string
          user_id: string
        }
        Update: {
          action_taken?: string | null
          alert_config_id?: string
          id?: string
          is_read?: boolean
          message?: string
          trigger_data?: Json
          triggered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "triggered_alerts_alert_config_id_fkey"
            columns: ["alert_config_id"]
            isOneToOne: false
            referencedRelation: "trading_alerts_config"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_trading_performance: {
        Args: { end_date: string; start_date: string; user_uuid: string }
        Returns: {
          max_drawdown: number
          profit_factor: number
          total_pnl: number
          total_trades: number
          win_rate: number
          winning_trades: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "trader" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "trader", "viewer"],
    },
  },
} as const
