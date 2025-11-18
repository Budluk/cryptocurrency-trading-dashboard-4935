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
      ai_football_signals: {
        Row: {
          confidence: number
          created_at: string
          expected_value: number | null
          expires_at: string | null
          fixture_id: number
          id: string
          market: string
          predicted_value: string | null
          reasoning: Json | null
          signal_type: string
          suggested_stake: number | null
        }
        Insert: {
          confidence: number
          created_at?: string
          expected_value?: number | null
          expires_at?: string | null
          fixture_id: number
          id?: string
          market: string
          predicted_value?: string | null
          reasoning?: Json | null
          signal_type: string
          suggested_stake?: number | null
        }
        Update: {
          confidence?: number
          created_at?: string
          expected_value?: number | null
          expires_at?: string | null
          fixture_id?: number
          id?: string
          market?: string
          predicted_value?: string | null
          reasoning?: Json | null
          signal_type?: string
          suggested_stake?: number | null
        }
        Relationships: []
      }
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
          created_at: string
          id: string
          is_active: boolean
          last_activity_at: string | null
          leverage_max: number
          max_consecutive_losses: number
          min_balance: number
          min_confidence: number
          min_qty: number
          reinvest_profit_pct: number
          risk_per_trade: number
          trader_is_running: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          leverage_max?: number
          max_consecutive_losses?: number
          min_balance?: number
          min_confidence?: number
          min_qty?: number
          reinvest_profit_pct?: number
          risk_per_trade?: number
          trader_is_running?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          leverage_max?: number
          max_consecutive_losses?: number
          min_balance?: number
          min_confidence?: number
          min_qty?: number
          reinvest_profit_pct?: number
          risk_per_trade?: number
          trader_is_running?: boolean
          updated_at?: string
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
          close_reason: string | null
          closed_at: string | null
          confidence: number | null
          current_price: number | null
          daily_pnl: number | null
          entry_price: number
          exchange_order_id: string | null
          exit_price: number | null
          highest_price: number | null
          id: string
          leverage: number | null
          opened_at: string
          order_source: string | null
          original_quantity: number | null
          partial_tp_executed: boolean | null
          pnl: number | null
          qty: number
          realized_pnl: number | null
          side: string
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          trailing_stop_percentage: number | null
          unrealized_pnl: number | null
          user_id: string
          volatility: number | null
        }
        Insert: {
          close_reason?: string | null
          closed_at?: string | null
          confidence?: number | null
          current_price?: number | null
          daily_pnl?: number | null
          entry_price: number
          exchange_order_id?: string | null
          exit_price?: number | null
          highest_price?: number | null
          id?: string
          leverage?: number | null
          opened_at?: string
          order_source?: string | null
          original_quantity?: number | null
          partial_tp_executed?: boolean | null
          pnl?: number | null
          qty: number
          realized_pnl?: number | null
          side: string
          status: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          trailing_stop_percentage?: number | null
          unrealized_pnl?: number | null
          user_id: string
          volatility?: number | null
        }
        Update: {
          close_reason?: string | null
          closed_at?: string | null
          confidence?: number | null
          current_price?: number | null
          daily_pnl?: number | null
          entry_price?: number
          exchange_order_id?: string | null
          exit_price?: number | null
          highest_price?: number | null
          id?: string
          leverage?: number | null
          opened_at?: string
          order_source?: string | null
          original_quantity?: number | null
          partial_tp_executed?: boolean | null
          pnl?: number | null
          qty?: number
          realized_pnl?: number | null
          side?: string
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          trailing_stop_percentage?: number | null
          unrealized_pnl?: number | null
          user_id?: string
          volatility?: number | null
        }
        Relationships: []
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
      bankroll_settings: {
        Row: {
          created_at: string
          current_bankroll: number
          current_daily_loss: number
          daily_loss_limit: number
          id: string
          initial_bankroll: number
          kelly_fraction: number
          last_reset_date: string
          max_bet: number
          min_bet: number
          risk_level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_bankroll?: number
          current_daily_loss?: number
          daily_loss_limit?: number
          id?: string
          initial_bankroll?: number
          kelly_fraction?: number
          last_reset_date?: string
          max_bet?: number
          min_bet?: number
          risk_level?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_bankroll?: number
          current_daily_loss?: number
          daily_loss_limit?: number
          id?: string
          initial_bankroll?: number
          kelly_fraction?: number
          last_reset_date?: string
          max_bet?: number
          min_bet?: number
          risk_level?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bet_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          enabled: boolean | null
          fixture_id: number
          id: string
          market: string
          threshold: number | null
          triggered_at: string | null
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          enabled?: boolean | null
          fixture_id: number
          id?: string
          market: string
          threshold?: number | null
          triggered_at?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          enabled?: boolean | null
          fixture_id?: number
          id?: string
          market?: string
          threshold?: number | null
          triggered_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bet_slips: {
        Row: {
          away_team: string | null
          country: string | null
          created_at: string
          estimated_prob: number | null
          ev: number | null
          fixture_id: number
          home_team: string | null
          id: string
          league: string | null
          market: string
          model_prob: number | null
          odd: number
          odds_snapshot: Json | null
          player_name: string | null
          profit: number | null
          result: number | null
          stake: number | null
          sub_market: string | null
          tags: string[] | null
          team: string | null
          user_id: string
        }
        Insert: {
          away_team?: string | null
          country?: string | null
          created_at?: string
          estimated_prob?: number | null
          ev?: number | null
          fixture_id: number
          home_team?: string | null
          id?: string
          league?: string | null
          market: string
          model_prob?: number | null
          odd: number
          odds_snapshot?: Json | null
          player_name?: string | null
          profit?: number | null
          result?: number | null
          stake?: number | null
          sub_market?: string | null
          tags?: string[] | null
          team?: string | null
          user_id: string
        }
        Update: {
          away_team?: string | null
          country?: string | null
          created_at?: string
          estimated_prob?: number | null
          ev?: number | null
          fixture_id?: number
          home_team?: string | null
          id?: string
          league?: string | null
          market?: string
          model_prob?: number | null
          odd?: number
          odds_snapshot?: Json | null
          player_name?: string | null
          profit?: number | null
          result?: number | null
          stake?: number | null
          sub_market?: string | null
          tags?: string[] | null
          team?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bet_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          tag_name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          tag_name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          tag_name?: string
          user_id?: string
        }
        Relationships: []
      }
      copy_trading_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_trader_drawdown: number
          min_trader_trades: number
          min_trader_win_rate: number
          total_capital_for_copy: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_trader_drawdown?: number
          min_trader_trades?: number
          min_trader_win_rate?: number
          total_capital_for_copy?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_trader_drawdown?: number
          min_trader_trades?: number
          min_trader_win_rate?: number
          total_capital_for_copy?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      copy_trading_followers: {
        Row: {
          capital_allocation_percent: number
          created_at: string
          follower_user_id: string
          id: string
          is_active: boolean
          max_leverage: number
          min_confidence: number
          trader_user_id: string
          updated_at: string
        }
        Insert: {
          capital_allocation_percent?: number
          created_at?: string
          follower_user_id: string
          id?: string
          is_active?: boolean
          max_leverage?: number
          min_confidence?: number
          trader_user_id: string
          updated_at?: string
        }
        Update: {
          capital_allocation_percent?: number
          created_at?: string
          follower_user_id?: string
          id?: string
          is_active?: boolean
          max_leverage?: number
          min_confidence?: number
          trader_user_id?: string
          updated_at?: string
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
      favorites: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_name: string
          item_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_name: string
          item_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_name?: string
          item_type?: string
          user_id?: string
        }
        Relationships: []
      }
      football_fixtures: {
        Row: {
          away_score: number | null
          away_team: string
          cached_at: string
          fixture_id: number
          home_score: number | null
          home_team: string
          id: string
          league_country: string | null
          league_name: string
          match_date: string
          minute: number | null
          status: string
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          away_team: string
          cached_at?: string
          fixture_id: number
          home_score?: number | null
          home_team: string
          id?: string
          league_country?: string | null
          league_name: string
          match_date: string
          minute?: number | null
          status: string
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          away_team?: string
          cached_at?: string
          fixture_id?: number
          home_score?: number | null
          home_team?: string
          id?: string
          league_country?: string | null
          league_name?: string
          match_date?: string
          minute?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      football_odds: {
        Row: {
          bookmaker: string
          cached_at: string
          fixture_id: number
          id: string
          label: string
          market_type: string
          odd_value: number
        }
        Insert: {
          bookmaker: string
          cached_at?: string
          fixture_id: number
          id?: string
          label: string
          market_type: string
          odd_value: number
        }
        Update: {
          bookmaker?: string
          cached_at?: string
          fixture_id?: number
          id?: string
          label?: string
          market_type?: string
          odd_value?: number
        }
        Relationships: []
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
      large_orders: {
        Row: {
          detected_at: string
          id: string
          impact_score: number | null
          is_institutional: boolean
          price: number
          side: string
          size: number
          symbol: string
          value_usd: number
        }
        Insert: {
          detected_at?: string
          id?: string
          impact_score?: number | null
          is_institutional?: boolean
          price: number
          side: string
          size: number
          symbol: string
          value_usd: number
        }
        Update: {
          detected_at?: string
          id?: string
          impact_score?: number | null
          is_institutional?: boolean
          price?: number
          side?: string
          size?: number
          symbol?: string
          value_usd?: number
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
          user_id: string
        }
        Insert: {
          asset_interval?: string | null
          asset_symbol?: string | null
          id?: string
          message: string
          timestamp?: string
          type: string
          user_id: string
        }
        Update: {
          asset_interval?: string | null
          asset_symbol?: string | null
          id?: string
          message?: string
          timestamp?: string
          type?: string
          user_id?: string
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
      ml_adaptive_config: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          is_enabled: boolean
          last_analysis_at: string | null
          optimal_patterns: Json | null
          recommended_leverage: number | null
          recommended_stop_loss_pct: number | null
          recommended_take_profit_pct: number | null
          trades_analyzed: number | null
          updated_at: string
          user_id: string
          win_rate_by_leverage: Json | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_analysis_at?: string | null
          optimal_patterns?: Json | null
          recommended_leverage?: number | null
          recommended_stop_loss_pct?: number | null
          recommended_take_profit_pct?: number | null
          trades_analyzed?: number | null
          updated_at?: string
          user_id: string
          win_rate_by_leverage?: Json | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_analysis_at?: string | null
          optimal_patterns?: Json | null
          recommended_leverage?: number | null
          recommended_stop_loss_pct?: number | null
          recommended_take_profit_pct?: number | null
          trades_analyzed?: number | null
          updated_at?: string
          user_id?: string
          win_rate_by_leverage?: Json | null
        }
        Relationships: []
      }
      multi_asset_trades: {
        Row: {
          closed_at: string | null
          confidence: number
          created_at: string
          entry_price: number
          exit_price: number | null
          id: string
          leverage: number
          opened_at: string
          quantity: number
          realized_pnl: number | null
          reason: string | null
          side: string
          status: string
          stop_loss: number
          symbol: string
          take_profit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          confidence: number
          created_at?: string
          entry_price: number
          exit_price?: number | null
          id?: string
          leverage: number
          opened_at?: string
          quantity: number
          realized_pnl?: number | null
          reason?: string | null
          side: string
          status?: string
          stop_loss: number
          symbol: string
          take_profit: number
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          confidence?: number
          created_at?: string
          entry_price?: number
          exit_price?: number | null
          id?: string
          leverage?: number
          opened_at?: string
          quantity?: number
          realized_pnl?: number | null
          reason?: string | null
          side?: string
          status?: string
          stop_loss?: number
          symbol?: string
          take_profit?: number
          updated_at?: string
          user_id?: string
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
      odds_comparison: {
        Row: {
          bookmaker: string
          fixture_id: number
          id: string
          is_best: boolean | null
          label: string
          market: string
          odd: number
          timestamp: string | null
        }
        Insert: {
          bookmaker: string
          fixture_id: number
          id?: string
          is_best?: boolean | null
          label: string
          market: string
          odd: number
          timestamp?: string | null
        }
        Update: {
          bookmaker?: string
          fixture_id?: number
          id?: string
          is_best?: boolean | null
          label?: string
          market?: string
          odd?: number
          timestamp?: string | null
        }
        Relationships: []
      }
      odds_history: {
        Row: {
          bookmaker: string | null
          created_at: string
          fixture_id: number
          id: string
          label: string | null
          market: string
          odd: number
        }
        Insert: {
          bookmaker?: string | null
          created_at?: string
          fixture_id: number
          id?: string
          label?: string | null
          market: string
          odd: number
        }
        Update: {
          bookmaker?: string | null
          created_at?: string
          fixture_id?: number
          id?: string
          label?: string | null
          market?: string
          odd?: number
        }
        Relationships: []
      }
      odds_movements: {
        Row: {
          bookmaker: string
          change_percentage: number | null
          fixture_id: number
          id: string
          label: string
          market: string
          odd_value: number
          previous_value: number | null
          recorded_at: string
        }
        Insert: {
          bookmaker: string
          change_percentage?: number | null
          fixture_id: number
          id?: string
          label: string
          market: string
          odd_value: number
          previous_value?: number | null
          recorded_at?: string
        }
        Update: {
          bookmaker?: string
          change_percentage?: number | null
          fixture_id?: number
          id?: string
          label?: string
          market?: string
          odd_value?: number
          previous_value?: number | null
          recorded_at?: string
        }
        Relationships: []
      }
      open_positions: {
        Row: {
          entry_price: number
          exchange_order_id: string | null
          id: string
          opened_at: string
          quantity: number
          side: string
          status: string
          stop_loss: number | null
          strategy_id: string | null
          symbol: string
          take_profit: number | null
          unrealized_pnl: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          entry_price: number
          exchange_order_id?: string | null
          id?: string
          opened_at?: string
          quantity: number
          side: string
          status?: string
          stop_loss?: number | null
          strategy_id?: string | null
          symbol: string
          take_profit?: number | null
          unrealized_pnl?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          entry_price?: number
          exchange_order_id?: string | null
          id?: string
          opened_at?: string
          quantity?: number
          side?: string
          status?: string
          stop_loss?: number | null
          strategy_id?: string | null
          symbol?: string
          take_profit?: number | null
          unrealized_pnl?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_positions_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_flow_analysis: {
        Row: {
          buy_volume: number
          created_at: string
          id: string
          institutional_flow: string | null
          large_orders_count: number
          net_volume: number
          price: number
          sell_volume: number
          symbol: string
          timeframe: string
          timestamp: string
          volume_delta_pct: number
        }
        Insert: {
          buy_volume: number
          created_at?: string
          id?: string
          institutional_flow?: string | null
          large_orders_count?: number
          net_volume: number
          price: number
          sell_volume: number
          symbol: string
          timeframe: string
          timestamp: string
          volume_delta_pct: number
        }
        Update: {
          buy_volume?: number
          created_at?: string
          id?: string
          institutional_flow?: string | null
          large_orders_count?: number
          net_volume?: number
          price?: number
          sell_volume?: number
          symbol?: string
          timeframe?: string
          timestamp?: string
          volume_delta_pct?: number
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
      portfolio_rebalance_config: {
        Row: {
          auto_execute: boolean
          created_at: string
          id: string
          is_enabled: boolean
          max_position_drift_pct: number
          min_correlation_threshold: number
          rebalance_frequency: string
          target_allocations: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_execute?: boolean
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_position_drift_pct?: number
          min_correlation_threshold?: number
          rebalance_frequency?: string
          target_allocations?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_execute?: boolean
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_position_drift_pct?: number
          min_correlation_threshold?: number
          rebalance_frequency?: string
          target_allocations?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_rebalance_history: {
        Row: {
          created_at: string
          executed: boolean
          executed_at: string | null
          id: string
          performance_after: Json | null
          performance_before: Json | null
          rebalance_type: string
          recommendations: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          executed?: boolean
          executed_at?: string | null
          id?: string
          performance_after?: Json | null
          performance_before?: Json | null
          rebalance_type: string
          recommendations: Json
          user_id: string
        }
        Update: {
          created_at?: string
          executed?: boolean
          executed_at?: string | null
          id?: string
          performance_after?: Json | null
          performance_before?: Json | null
          rebalance_type?: string
          recommendations?: Json
          user_id?: string
        }
        Relationships: []
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
      push_notifications_config: {
        Row: {
          created_at: string
          daily_limit_warning: boolean
          enabled: boolean
          favorite_match_started: boolean
          id: string
          odds_movement_threshold: number
          profit_goal_amount: number | null
          updated_at: string
          user_id: string
          value_bet_threshold: number
        }
        Insert: {
          created_at?: string
          daily_limit_warning?: boolean
          enabled?: boolean
          favorite_match_started?: boolean
          id?: string
          odds_movement_threshold?: number
          profit_goal_amount?: number | null
          updated_at?: string
          user_id: string
          value_bet_threshold?: number
        }
        Update: {
          created_at?: string
          daily_limit_warning?: boolean
          enabled?: boolean
          favorite_match_started?: boolean
          id?: string
          odds_movement_threshold?: number
          profit_goal_amount?: number | null
          updated_at?: string
          user_id?: string
          value_bet_threshold?: number
        }
        Relationships: []
      }
      risk_management_settings: {
        Row: {
          created_at: string | null
          current_daily_loss: number | null
          id: string
          last_reset_date: string | null
          max_daily_loss: number | null
          max_positions: number | null
          trading_paused: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_daily_loss?: number | null
          id?: string
          last_reset_date?: string | null
          max_daily_loss?: number | null
          max_positions?: number | null
          trading_paused?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_daily_loss?: number | null
          id?: string
          last_reset_date?: string | null
          max_daily_loss?: number | null
          max_positions?: number | null
          trading_paused?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sentiment_analysis: {
        Row: {
          analyzed_at: string
          confidence: number
          content: string | null
          created_at: string
          id: string
          impact_prediction: Json | null
          keywords: string[] | null
          sentiment_score: number
          source: string
          symbol: string
          url: string | null
        }
        Insert: {
          analyzed_at?: string
          confidence: number
          content?: string | null
          created_at?: string
          id?: string
          impact_prediction?: Json | null
          keywords?: string[] | null
          sentiment_score: number
          source: string
          symbol: string
          url?: string | null
        }
        Update: {
          analyzed_at?: string
          confidence?: number
          content?: string | null
          created_at?: string
          id?: string
          impact_prediction?: Json | null
          keywords?: string[] | null
          sentiment_score?: number
          source?: string
          symbol?: string
          url?: string | null
        }
        Relationships: []
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
          user_id: string
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
          user_id: string
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
          user_id?: string
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
          user_id: string
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
          user_id: string
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
          user_id?: string
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
          user_id: string
          winning_trades: number
        }
        Insert: {
          id?: string
          last_updated_at?: string
          strategy_id: string
          total_pnl?: number
          total_trades?: number
          user_id: string
          winning_trades?: number
        }
        Update: {
          id?: string
          last_updated_at?: string
          strategy_id?: string
          total_pnl?: number
          total_trades?: number
          user_id?: string
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
      team_statistics: {
        Row: {
          away_goals_avg: number | null
          away_goals_conceded_avg: number | null
          h2h_data: Json | null
          home_goals_avg: number | null
          home_goals_conceded_avg: number | null
          id: string
          last_5_matches: Json | null
          recent_form_away: string | null
          recent_form_home: string | null
          team_id: number
          team_name: string
          updated_at: string
        }
        Insert: {
          away_goals_avg?: number | null
          away_goals_conceded_avg?: number | null
          h2h_data?: Json | null
          home_goals_avg?: number | null
          home_goals_conceded_avg?: number | null
          id?: string
          last_5_matches?: Json | null
          recent_form_away?: string | null
          recent_form_home?: string | null
          team_id: number
          team_name: string
          updated_at?: string
        }
        Update: {
          away_goals_avg?: number | null
          away_goals_conceded_avg?: number | null
          h2h_data?: Json | null
          home_goals_avg?: number | null
          home_goals_conceded_avg?: number | null
          id?: string
          last_5_matches?: Json | null
          recent_form_away?: string | null
          recent_form_home?: string | null
          team_id?: number
          team_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      trader_profiles: {
        Row: {
          avg_trade_duration_minutes: number
          bio: string | null
          created_at: string
          display_name: string
          followers_count: number
          id: string
          is_public: boolean
          max_drawdown: number
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
          avg_trade_duration_minutes?: number
          bio?: string | null
          created_at?: string
          display_name: string
          followers_count?: number
          id?: string
          is_public?: boolean
          max_drawdown?: number
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
          avg_trade_duration_minutes?: number
          bio?: string | null
          created_at?: string
          display_name?: string
          followers_count?: number
          id?: string
          is_public?: boolean
          max_drawdown?: number
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
          user_id: string
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
          user_id: string
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
          user_id?: string
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
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parameters?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parameters?: Json | null
          updated_at?: string | null
          user_id?: string
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
      user_preferences: {
        Row: {
          auto_tracking: boolean | null
          created_at: string | null
          favorite_leagues: string[] | null
          id: string
          push_notifications: boolean | null
          sound_enabled: boolean | null
          theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_tracking?: boolean | null
          created_at?: string | null
          favorite_leagues?: string[] | null
          id?: string
          push_notifications?: boolean | null
          sound_enabled?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_tracking?: boolean | null
          created_at?: string | null
          favorite_leagues?: string[] | null
          id?: string
          push_notifications?: boolean | null
          sound_enabled?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_risk_settings: {
        Row: {
          created_at: string
          id: string
          max_daily_loss_percent: number | null
          max_leverage: number | null
          max_open_positions: number | null
          max_position_size_percent: number | null
          time_stop_hours: number | null
          trailing_stop_enabled: boolean | null
          trailing_stop_percent: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_daily_loss_percent?: number | null
          max_leverage?: number | null
          max_open_positions?: number | null
          max_position_size_percent?: number | null
          time_stop_hours?: number | null
          trailing_stop_enabled?: boolean | null
          trailing_stop_percent?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_daily_loss_percent?: number | null
          max_leverage?: number | null
          max_open_positions?: number | null
          max_position_size_percent?: number | null
          time_stop_hours?: number | null
          trailing_stop_enabled?: boolean | null
          trailing_stop_percent?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      clean_old_football_cache: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reset_daily_loss: { Args: never; Returns: undefined }
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
