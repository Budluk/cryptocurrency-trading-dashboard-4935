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
    PostgrestVersion: "12.2.12"
  }
  public: {
    Tables: {
      aggressive_trading_config: {
        Row: {
          allow_hedging: boolean | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          max_concurrent_positions: number | null
          max_leverage: number | null
          min_confidence_threshold: number | null
          partial_exit_percent: number | null
          position_size_multiplier: number | null
          trailing_stop_percent: number | null
          updated_at: string | null
          use_partial_exits: boolean | null
          use_trailing_stops: boolean | null
          user_id: string
        }
        Insert: {
          allow_hedging?: boolean | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          max_concurrent_positions?: number | null
          max_leverage?: number | null
          min_confidence_threshold?: number | null
          partial_exit_percent?: number | null
          position_size_multiplier?: number | null
          trailing_stop_percent?: number | null
          updated_at?: string | null
          use_partial_exits?: boolean | null
          use_trailing_stops?: boolean | null
          user_id: string
        }
        Update: {
          allow_hedging?: boolean | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          max_concurrent_positions?: number | null
          max_leverage?: number | null
          min_confidence_threshold?: number | null
          partial_exit_percent?: number | null
          position_size_multiplier?: number | null
          trailing_stop_percent?: number | null
          updated_at?: string | null
          use_partial_exits?: boolean | null
          use_trailing_stops?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
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
      ai_learning_data: {
        Row: {
          confidence_adjustment: number | null
          created_at: string | null
          entry_features: Json
          exit_features: Json | null
          id: string
          lessons_learned: Json | null
          outcome: string
          pnl: number
          position_id: string | null
          user_id: string
        }
        Insert: {
          confidence_adjustment?: number | null
          created_at?: string | null
          entry_features: Json
          exit_features?: Json | null
          id?: string
          lessons_learned?: Json | null
          outcome: string
          pnl: number
          position_id?: string | null
          user_id: string
        }
        Update: {
          confidence_adjustment?: number | null
          created_at?: string | null
          entry_features?: Json
          exit_features?: Json | null
          id?: string
          lessons_learned?: Json | null
          outcome?: string
          pnl?: number
          position_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_learning_data_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "auto_trader_positions"
            referencedColumns: ["id"]
          },
        ]
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
      api_rate_limit_log: {
        Row: {
          calls_made: number | null
          created_at: string | null
          endpoint: string
          id: string
          rate_limit_remaining: number | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          calls_made?: number | null
          created_at?: string | null
          endpoint: string
          id?: string
          rate_limit_remaining?: number | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          calls_made?: number | null
          created_at?: string | null
          endpoint?: string
          id?: string
          rate_limit_remaining?: number | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      arbitrage_operations: {
        Row: {
          date_completed: string | null
          date_created: string | null
          entry_price: number
          exit_price: number | null
          id: string
          profit: number | null
          profit_percentage: number | null
          quantity: number
          status: string | null
          trading_pair: string
          user_id: string
        }
        Insert: {
          date_completed?: string | null
          date_created?: string | null
          entry_price: number
          exit_price?: number | null
          id?: string
          profit?: number | null
          profit_percentage?: number | null
          quantity: number
          status?: string | null
          trading_pair: string
          user_id: string
        }
        Update: {
          date_completed?: string | null
          date_created?: string | null
          entry_price?: number
          exit_price?: number | null
          id?: string
          profit?: number | null
          profit_percentage?: number | null
          quantity?: number
          status?: string | null
          trading_pair?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_correlations: {
        Row: {
          asset_1: string
          asset_2: string
          correlation_score: number
          created_at: string | null
          id: string
        }
        Insert: {
          asset_1: string
          asset_2: string
          correlation_score: number
          created_at?: string | null
          id?: string
        }
        Update: {
          asset_1?: string
          asset_2?: string
          correlation_score?: number
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      asset_hour_performance: {
        Row: {
          avg_pnl: number | null
          best_leverage: number | null
          hour_utc: number
          id: string
          symbol: string
          total_pnl: number | null
          total_trades: number | null
          updated_at: string
          user_id: string
          win_rate: number | null
          winning_trades: number | null
        }
        Insert: {
          avg_pnl?: number | null
          best_leverage?: number | null
          hour_utc: number
          id?: string
          symbol: string
          total_pnl?: number | null
          total_trades?: number | null
          updated_at?: string
          user_id: string
          win_rate?: number | null
          winning_trades?: number | null
        }
        Update: {
          avg_pnl?: number | null
          best_leverage?: number | null
          hour_utc?: number
          id?: string
          symbol?: string
          total_pnl?: number | null
          total_trades?: number | null
          updated_at?: string
          user_id?: string
          win_rate?: number | null
          winning_trades?: number | null
        }
        Relationships: []
      }
      auto_trader_config: {
        Row: {
          allow_hedging: boolean | null
          created_at: string
          drawdown_limit_percent: number | null
          id: string
          is_active: boolean
          last_activity_at: string | null
          learning_mode: boolean | null
          leverage_max: number
          max_concurrent_positions: number | null
          max_consecutive_losses: number
          min_balance: number
          min_confidence: number
          min_qty: number
          partial_exit_percent: number | null
          position_size_multiplier: number | null
          reinvest_profit_pct: number
          risk_per_trade: number
          trader_is_running: boolean
          trailing_stop_percent: number | null
          updated_at: string
          use_dynamic_sizing: boolean | null
          use_multi_timeframe: boolean | null
          use_partial_exits: boolean | null
          use_trailing_stops: boolean | null
          user_id: string
        }
        Insert: {
          allow_hedging?: boolean | null
          created_at?: string
          drawdown_limit_percent?: number | null
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          learning_mode?: boolean | null
          leverage_max?: number
          max_concurrent_positions?: number | null
          max_consecutive_losses?: number
          min_balance?: number
          min_confidence?: number
          min_qty?: number
          partial_exit_percent?: number | null
          position_size_multiplier?: number | null
          reinvest_profit_pct?: number
          risk_per_trade?: number
          trader_is_running?: boolean
          trailing_stop_percent?: number | null
          updated_at?: string
          use_dynamic_sizing?: boolean | null
          use_multi_timeframe?: boolean | null
          use_partial_exits?: boolean | null
          use_trailing_stops?: boolean | null
          user_id: string
        }
        Update: {
          allow_hedging?: boolean | null
          created_at?: string
          drawdown_limit_percent?: number | null
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          learning_mode?: boolean | null
          leverage_max?: number
          max_concurrent_positions?: number | null
          max_consecutive_losses?: number
          min_balance?: number
          min_confidence?: number
          min_qty?: number
          partial_exit_percent?: number | null
          position_size_multiplier?: number | null
          reinvest_profit_pct?: number
          risk_per_trade?: number
          trader_is_running?: boolean
          trailing_stop_percent?: number | null
          updated_at?: string
          use_dynamic_sizing?: boolean | null
          use_multi_timeframe?: boolean | null
          use_partial_exits?: boolean | null
          use_trailing_stops?: boolean | null
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          log_type: string
          message: string
          metadata?: Json | null
          position_id?: string | null
          symbol?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          log_type?: string
          message?: string
          metadata?: Json | null
          position_id?: string | null
          symbol?: string | null
          user_id?: string | null
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
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
      bot_config: {
        Row: {
          api_key_encrypted: string | null
          api_secret_encrypted: string | null
          cache_enabled: boolean | null
          connection_status: string | null
          created_at: string | null
          current_drawdown: number | null
          error_handling_enabled: boolean | null
          id: string
          is_active: boolean | null
          is_running: boolean | null
          is_testnet: boolean | null
          last_activity_at: string | null
          last_error: string | null
          last_sync_at: string | null
          max_drawdown_limit: number | null
          min_price: number | null
          optimization_enabled: boolean | null
          risk_percent: number | null
          spread_threshold: number | null
          stop_loss_percent: number | null
          take_profit_percent: number | null
          updated_at: string | null
          user_id: string
          volume_threshold: number | null
          websocket_enabled: boolean | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          cache_enabled?: boolean | null
          connection_status?: string | null
          created_at?: string | null
          current_drawdown?: number | null
          error_handling_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          is_running?: boolean | null
          is_testnet?: boolean | null
          last_activity_at?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          max_drawdown_limit?: number | null
          min_price?: number | null
          optimization_enabled?: boolean | null
          risk_percent?: number | null
          spread_threshold?: number | null
          stop_loss_percent?: number | null
          take_profit_percent?: number | null
          updated_at?: string | null
          user_id: string
          volume_threshold?: number | null
          websocket_enabled?: boolean | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          cache_enabled?: boolean | null
          connection_status?: string | null
          created_at?: string | null
          current_drawdown?: number | null
          error_handling_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          is_running?: boolean | null
          is_testnet?: boolean | null
          last_activity_at?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          max_drawdown_limit?: number | null
          min_price?: number | null
          optimization_enabled?: boolean | null
          risk_percent?: number | null
          spread_threshold?: number | null
          stop_loss_percent?: number | null
          take_profit_percent?: number | null
          updated_at?: string | null
          user_id?: string
          volume_threshold?: number | null
          websocket_enabled?: boolean | null
        }
        Relationships: []
      }
      bot_errors: {
        Row: {
          context: Json | null
          created_at: string | null
          error_message: string
          error_type: string
          id: string
          resolved: boolean | null
          retry_count: number | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          error_message: string
          error_type: string
          id?: string
          resolved?: boolean | null
          retry_count?: number | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          error_message?: string
          error_type?: string
          id?: string
          resolved?: boolean | null
          retry_count?: number | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bot_patterns: {
        Row: {
          asset: string
          confidence: number
          created_at: string | null
          id: string
          pattern_score: number
          pattern_type: string
          timeframe: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          asset: string
          confidence: number
          created_at?: string | null
          id?: string
          pattern_score: number
          pattern_type: string
          timeframe: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          asset?: string
          confidence?: number
          created_at?: string | null
          id?: string
          pattern_score?: number
          pattern_type?: string
          timeframe?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bot_performance_analysis: {
        Row: {
          asset: string
          avg_pnl: number | null
          best_hours: string[] | null
          best_timeframes: string[] | null
          created_at: string | null
          id: string
          total_trades: number | null
          user_id: string | null
          win_rate: number | null
        }
        Insert: {
          asset: string
          avg_pnl?: number | null
          best_hours?: string[] | null
          best_timeframes?: string[] | null
          created_at?: string | null
          id?: string
          total_trades?: number | null
          user_id?: string | null
          win_rate?: number | null
        }
        Update: {
          asset?: string
          avg_pnl?: number | null
          best_hours?: string[] | null
          best_timeframes?: string[] | null
          created_at?: string | null
          id?: string
          total_trades?: number | null
          user_id?: string | null
          win_rate?: number | null
        }
        Relationships: []
      }
      bot_statistics: {
        Row: {
          assets_analyzed: string[] | null
          avg_loss: number | null
          avg_win: number | null
          bottom_assets: Json | null
          created_at: string | null
          daily_pnl: number | null
          id: string
          last_optimization_at: string | null
          last_reset_date: string | null
          losing_trades: number | null
          loss_count: number | null
          optimization_applied: boolean | null
          top_assets: Json | null
          total_pnl: number | null
          total_trades: number | null
          trades_today: number | null
          updated_at: string | null
          user_id: string
          win_count: number | null
          win_rate: number | null
          winning_trades: number | null
        }
        Insert: {
          assets_analyzed?: string[] | null
          avg_loss?: number | null
          avg_win?: number | null
          bottom_assets?: Json | null
          created_at?: string | null
          daily_pnl?: number | null
          id?: string
          last_optimization_at?: string | null
          last_reset_date?: string | null
          losing_trades?: number | null
          loss_count?: number | null
          optimization_applied?: boolean | null
          top_assets?: Json | null
          total_pnl?: number | null
          total_trades?: number | null
          trades_today?: number | null
          updated_at?: string | null
          user_id: string
          win_count?: number | null
          win_rate?: number | null
          winning_trades?: number | null
        }
        Update: {
          assets_analyzed?: string[] | null
          avg_loss?: number | null
          avg_win?: number | null
          bottom_assets?: Json | null
          created_at?: string | null
          daily_pnl?: number | null
          id?: string
          last_optimization_at?: string | null
          last_reset_date?: string | null
          losing_trades?: number | null
          loss_count?: number | null
          optimization_applied?: boolean | null
          top_assets?: Json | null
          total_pnl?: number | null
          total_trades?: number | null
          trades_today?: number | null
          updated_at?: string | null
          user_id?: string
          win_count?: number | null
          win_rate?: number | null
          winning_trades?: number | null
        }
        Relationships: []
      }
      bot_trades: {
        Row: {
          created_at: string | null
          duration_minutes: number | null
          entry_price: number | null
          entry_time: string | null
          exit_price: number | null
          exit_time: string | null
          id: string
          market_condition: string | null
          pattern_score: number | null
          pattern_used: string | null
          pnl: number | null
          pnl_percent: number | null
          quantity: number | null
          status: string | null
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_minutes?: number | null
          entry_price?: number | null
          entry_time?: string | null
          exit_price?: number | null
          exit_time?: string | null
          id?: string
          market_condition?: string | null
          pattern_score?: number | null
          pattern_used?: string | null
          pnl?: number | null
          pnl_percent?: number | null
          quantity?: number | null
          status?: string | null
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number | null
          entry_price?: number | null
          entry_time?: string | null
          exit_price?: number | null
          exit_time?: string | null
          id?: string
          market_condition?: string | null
          pattern_score?: number | null
          pattern_used?: string | null
          pnl?: number | null
          pnl_percent?: number | null
          quantity?: number | null
          status?: string | null
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          user_id?: string
        }
        Relationships: []
      }
      bybit_config: {
        Row: {
          api_key_encrypted: string | null
          api_secret_encrypted: string | null
          created_at: string | null
          id: string
          is_testnet: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_testnet?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_testnet?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bybit_market_data: {
        Row: {
          created_at: string | null
          current_price: number | null
          high_24h: number | null
          id: string
          low_24h: number | null
          symbol: string
          timestamp: string | null
          volume_24h: number | null
        }
        Insert: {
          created_at?: string | null
          current_price?: number | null
          high_24h?: number | null
          id?: string
          low_24h?: number | null
          symbol: string
          timestamp?: string | null
          volume_24h?: number | null
        }
        Update: {
          created_at?: string | null
          current_price?: number | null
          high_24h?: number | null
          id?: string
          low_24h?: number | null
          symbol?: string
          timestamp?: string | null
          volume_24h?: number | null
        }
        Relationships: []
      }
      bybit_pairs: {
        Row: {
          base_asset: string | null
          created_at: string | null
          id: string
          max_qty: number | null
          min_qty: number | null
          price_precision: number | null
          qty_precision: number | null
          quote_asset: string | null
          symbol: string
          updated_at: string | null
        }
        Insert: {
          base_asset?: string | null
          created_at?: string | null
          id?: string
          max_qty?: number | null
          min_qty?: number | null
          price_precision?: number | null
          qty_precision?: number | null
          quote_asset?: string | null
          symbol: string
          updated_at?: string | null
        }
        Update: {
          base_asset?: string | null
          created_at?: string | null
          id?: string
          max_qty?: number | null
          min_qty?: number | null
          price_precision?: number | null
          qty_precision?: number | null
          quote_asset?: string | null
          symbol?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      bybit_rsa_keys: {
        Row: {
          created_at: string
          id: number
          private_pem: string
          public_pem: string
        }
        Insert: {
          created_at?: string
          id?: number
          private_pem: string
          public_pem: string
        }
        Update: {
          created_at?: string
          id?: number
          private_pem?: string
          public_pem?: string
        }
        Relationships: []
      }
      candle_data: {
        Row: {
          close: number | null
          created_at: string | null
          ema20_1m: number | null
          ema20_5m: number | null
          ema50_5m: number | null
          high: number | null
          id: string
          low: number | null
          open: number | null
          quality_score: number | null
          signal: string | null
          symbol: string
          timeframe: string
          timestamp: string
          volume: number | null
        }
        Insert: {
          close?: number | null
          created_at?: string | null
          ema20_1m?: number | null
          ema20_5m?: number | null
          ema50_5m?: number | null
          high?: number | null
          id?: string
          low?: number | null
          open?: number | null
          quality_score?: number | null
          signal?: string | null
          symbol: string
          timeframe: string
          timestamp: string
          volume?: number | null
        }
        Update: {
          close?: number | null
          created_at?: string | null
          ema20_1m?: number | null
          ema20_5m?: number | null
          ema50_5m?: number | null
          high?: number | null
          id?: string
          low?: number | null
          open?: number | null
          quality_score?: number | null
          signal?: string | null
          symbol?: string
          timeframe?: string
          timestamp?: string
          volume?: number | null
        }
        Relationships: []
      }
      complementary_bot_capital_allocation: {
        Row: {
          allocated_amount: number | null
          id: string
          reserved_amount: number | null
          strategy_id: string
          updated_at: string
          used_amount: number | null
          user_id: string
        }
        Insert: {
          allocated_amount?: number | null
          id?: string
          reserved_amount?: number | null
          strategy_id: string
          updated_at?: string
          used_amount?: number | null
          user_id: string
        }
        Update: {
          allocated_amount?: number | null
          id?: string
          reserved_amount?: number | null
          strategy_id?: string
          updated_at?: string
          used_amount?: number | null
          user_id?: string
        }
        Relationships: []
      }
      complementary_bot_config: {
        Row: {
          created_at: string
          daily_loss_limit: number | null
          funding_arbitrage_settings: Json | null
          grid_bot_settings: Json | null
          id: string
          max_capital_percent: number | null
          max_concurrent_positions: number | null
          max_leverage: number | null
          mode: string
          pause_all_bots: boolean | null
          real_mode_confirmed: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_loss_limit?: number | null
          funding_arbitrage_settings?: Json | null
          grid_bot_settings?: Json | null
          id?: string
          max_capital_percent?: number | null
          max_concurrent_positions?: number | null
          max_leverage?: number | null
          mode?: string
          pause_all_bots?: boolean | null
          real_mode_confirmed?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_loss_limit?: number | null
          funding_arbitrage_settings?: Json | null
          grid_bot_settings?: Json | null
          id?: string
          max_capital_percent?: number | null
          max_concurrent_positions?: number | null
          max_leverage?: number | null
          mode?: string
          pause_all_bots?: boolean | null
          real_mode_confirmed?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      complementary_bot_funding_opportunities: {
        Row: {
          apr: number | null
          created_at: string
          funding_rate: number | null
          id: string
          next_funding_time: string | null
          opportunity_score: number | null
          spread: number | null
          symbol: string
          updated_at: string
          volume_24h: number | null
        }
        Insert: {
          apr?: number | null
          created_at?: string
          funding_rate?: number | null
          id?: string
          next_funding_time?: string | null
          opportunity_score?: number | null
          spread?: number | null
          symbol: string
          updated_at?: string
          volume_24h?: number | null
        }
        Update: {
          apr?: number | null
          created_at?: string
          funding_rate?: number | null
          id?: string
          next_funding_time?: string | null
          opportunity_score?: number | null
          spread?: number | null
          symbol?: string
          updated_at?: string
          volume_24h?: number | null
        }
        Relationships: []
      }
      complementary_bot_grids: {
        Row: {
          capital_allocated: number
          closed_at: string | null
          created_at: string
          grid_count: number
          grids_executed: number | null
          id: string
          profit_accumulated: number | null
          range_lower: number
          range_upper: number
          status: string
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capital_allocated: number
          closed_at?: string | null
          created_at?: string
          grid_count: number
          grids_executed?: number | null
          id?: string
          profit_accumulated?: number | null
          range_lower: number
          range_upper: number
          status: string
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capital_allocated?: number
          closed_at?: string | null
          created_at?: string
          grid_count?: number
          grids_executed?: number | null
          id?: string
          profit_accumulated?: number | null
          range_lower?: number
          range_upper?: number
          status?: string
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      complementary_bot_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          log_type: string
          status: string
          symbol: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          log_type: string
          status: string
          symbol?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          log_type?: string
          status?: string
          symbol?: string | null
          user_id?: string
        }
        Relationships: []
      }
      complementary_bot_simulated_trades: {
        Row: {
          closed_at: string | null
          created_at: string
          entry_price: number | null
          exit_price: number | null
          id: string
          pnl: number | null
          quantity: number | null
          side: string
          symbol: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          pnl?: number | null
          quantity?: number | null
          side: string
          symbol: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          pnl?: number | null
          quantity?: number | null
          side?: string
          symbol?: string
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
      diagnostic_logs: {
        Row: {
          category: string
          context: Json | null
          created_at: string
          error_details: Json | null
          id: string
          message: string
          user_id: string | null
        }
        Insert: {
          category: string
          context?: Json | null
          created_at?: string
          error_details?: Json | null
          id?: string
          message: string
          user_id?: string | null
        }
        Update: {
          category?: string
          context?: Json | null
          created_at?: string
          error_details?: Json | null
          id?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
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
      funding_operations_log: {
        Row: {
          actual_net_profit: number | null
          created_at: string | null
          entry_reason: string | null
          estimated_fees: number | null
          estimated_slippage: number | null
          exit_reason: string | null
          exit_time: string | null
          expected_funding: number | null
          expected_net_profit: number | null
          futures_entry_fee: number | null
          futures_entry_price: number | null
          id: string
          notes: string | null
          operation_id: string
          opportunity_score: number | null
          roi: number | null
          spot_entry_fee: number | null
          spot_entry_price: number | null
          status: string
          symbol: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_net_profit?: number | null
          created_at?: string | null
          entry_reason?: string | null
          estimated_fees?: number | null
          estimated_slippage?: number | null
          exit_reason?: string | null
          exit_time?: string | null
          expected_funding?: number | null
          expected_net_profit?: number | null
          futures_entry_fee?: number | null
          futures_entry_price?: number | null
          id?: string
          notes?: string | null
          operation_id: string
          opportunity_score?: number | null
          roi?: number | null
          spot_entry_fee?: number | null
          spot_entry_price?: number | null
          status?: string
          symbol: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_net_profit?: number | null
          created_at?: string | null
          entry_reason?: string | null
          estimated_fees?: number | null
          estimated_slippage?: number | null
          exit_reason?: string | null
          exit_time?: string | null
          expected_funding?: number | null
          expected_net_profit?: number | null
          futures_entry_fee?: number | null
          futures_entry_price?: number | null
          id?: string
          notes?: string | null
          operation_id?: string
          opportunity_score?: number | null
          roi?: number | null
          spot_entry_fee?: number | null
          spot_entry_price?: number | null
          status?: string
          symbol?: string
          updated_at?: string | null
          user_id?: string
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
      market_anomalies: {
        Row: {
          anomaly_type: string
          created_at: string | null
          details: Json | null
          id: string
          severity: number
          symbol: string
        }
        Insert: {
          anomaly_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          severity: number
          symbol: string
        }
        Update: {
          anomaly_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          severity?: number
          symbol?: string
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
      market_data_cache: {
        Row: {
          asset: string
          created_at: string | null
          id: string
          price: number | null
          spread: number | null
          timestamp: string | null
          ttl_expires_at: string | null
          volume: number | null
        }
        Insert: {
          asset: string
          created_at?: string | null
          id?: string
          price?: number | null
          spread?: number | null
          timestamp?: string | null
          ttl_expires_at?: string | null
          volume?: number | null
        }
        Update: {
          asset?: string
          created_at?: string | null
          id?: string
          price?: number | null
          spread?: number | null
          timestamp?: string | null
          ttl_expires_at?: string | null
          volume?: number | null
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
      market_regimes: {
        Row: {
          confidence: number
          created_at: string | null
          detected_at: string | null
          id: string
          indicators: Json | null
          regime: string
          symbol: string
          trend_strength: number
          user_id: string
          volatility: number
        }
        Insert: {
          confidence: number
          created_at?: string | null
          detected_at?: string | null
          id?: string
          indicators?: Json | null
          regime: string
          symbol: string
          trend_strength: number
          user_id: string
          volatility: number
        }
        Update: {
          confidence?: number
          created_at?: string | null
          detected_at?: string | null
          id?: string
          indicators?: Json | null
          regime?: string
          symbol?: string
          trend_strength?: number
          user_id?: string
          volatility?: number
        }
        Relationships: []
      }
      market_sentiment_cache: {
        Row: {
          avoid_trading: boolean | null
          expires_at: string
          fear_greed_index: number | null
          fear_greed_label: string | null
          fetched_at: string
          funding_rate: number | null
          funding_rate_trend: string | null
          id: string
          long_short_ratio: number | null
          major_news_count: number | null
          news_sentiment_score: number | null
          open_interest: number | null
          open_interest_change_pct: number | null
          symbol: string
        }
        Insert: {
          avoid_trading?: boolean | null
          expires_at?: string
          fear_greed_index?: number | null
          fear_greed_label?: string | null
          fetched_at?: string
          funding_rate?: number | null
          funding_rate_trend?: string | null
          id?: string
          long_short_ratio?: number | null
          major_news_count?: number | null
          news_sentiment_score?: number | null
          open_interest?: number | null
          open_interest_change_pct?: number | null
          symbol: string
        }
        Update: {
          avoid_trading?: boolean | null
          expires_at?: string
          fear_greed_index?: number | null
          fear_greed_label?: string | null
          fetched_at?: string
          funding_rate?: number | null
          funding_rate_trend?: string | null
          id?: string
          long_short_ratio?: number | null
          major_news_count?: number | null
          news_sentiment_score?: number | null
          open_interest?: number | null
          open_interest_change_pct?: number | null
          symbol?: string
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
      ml_predictions: {
        Row: {
          created_at: string | null
          id: string
          pnl_range_high: number | null
          pnl_range_low: number | null
          recommended_size: number | null
          symbol: string
          user_id: string | null
          win_probability: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          pnl_range_high?: number | null
          pnl_range_low?: number | null
          recommended_size?: number | null
          symbol: string
          user_id?: string | null
          win_probability: number
        }
        Update: {
          created_at?: string | null
          id?: string
          pnl_range_high?: number | null
          pnl_range_low?: number | null
          recommended_size?: number | null
          symbol?: string
          user_id?: string | null
          win_probability?: number
        }
        Relationships: []
      }
      monitored_pairs: {
        Row: {
          added_at: string | null
          current_price: number | null
          current_volume: number | null
          ema20_1m: number | null
          ema20_5m: number | null
          ema50_5m: number | null
          id: string
          last_price: number | null
          last_price_update: string | null
          last_updated: string | null
          pattern_detected: string | null
          pattern_score: number | null
          real_time_price: number | null
          real_time_volume: number | null
          spread: number | null
          status: string | null
          symbol: string
          trend: string | null
          user_id: string
          volume_24h: number | null
        }
        Insert: {
          added_at?: string | null
          current_price?: number | null
          current_volume?: number | null
          ema20_1m?: number | null
          ema20_5m?: number | null
          ema50_5m?: number | null
          id?: string
          last_price?: number | null
          last_price_update?: string | null
          last_updated?: string | null
          pattern_detected?: string | null
          pattern_score?: number | null
          real_time_price?: number | null
          real_time_volume?: number | null
          spread?: number | null
          status?: string | null
          symbol: string
          trend?: string | null
          user_id: string
          volume_24h?: number | null
        }
        Update: {
          added_at?: string | null
          current_price?: number | null
          current_volume?: number | null
          ema20_1m?: number | null
          ema20_5m?: number | null
          ema50_5m?: number | null
          id?: string
          last_price?: number | null
          last_price_update?: string | null
          last_updated?: string | null
          pattern_detected?: string | null
          pattern_score?: number | null
          real_time_price?: number | null
          real_time_volume?: number | null
          spread?: number | null
          status?: string | null
          symbol?: string
          trend?: string | null
          user_id?: string
          volume_24h?: number | null
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
      real_accounts: {
        Row: {
          account_type: string | null
          api_key_encrypted: string
          created_at: string | null
          exchange: string
          id: string
          is_active: boolean | null
          secret_key_encrypted: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_type?: string | null
          api_key_encrypted: string
          created_at?: string | null
          exchange?: string
          id?: string
          is_active?: boolean | null
          secret_key_encrypted: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_type?: string | null
          api_key_encrypted?: string
          created_at?: string | null
          exchange?: string
          id?: string
          is_active?: boolean | null
          secret_key_encrypted?: string
          updated_at?: string | null
          user_id?: string
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
      sentiment_signals: {
        Row: {
          fear_greed_index: number | null
          funding_rate: number | null
          id: string
          news_sentiment: number | null
          open_interest: number | null
          sentiment_score: number
          social_volume: number | null
          symbol: string
          timestamp: string | null
          whale_activity: Json | null
        }
        Insert: {
          fear_greed_index?: number | null
          funding_rate?: number | null
          id?: string
          news_sentiment?: number | null
          open_interest?: number | null
          sentiment_score: number
          social_volume?: number | null
          symbol: string
          timestamp?: string | null
          whale_activity?: Json | null
        }
        Update: {
          fear_greed_index?: number | null
          funding_rate?: number | null
          id?: string
          news_sentiment?: number | null
          open_interest?: number | null
          sentiment_score?: number
          social_volume?: number | null
          symbol?: string
          timestamp?: string | null
          whale_activity?: Json | null
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
      trading_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          proposal: Json | null
          proposal_status: string | null
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          proposal?: Json | null
          proposal_status?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          proposal?: Json | null
          proposal_status?: string | null
          role?: string
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
      trading_performance_metrics: {
        Row: {
          avg_loss: number
          avg_win: number
          created_at: string | null
          expectancy: number
          id: string
          losing_trades: number
          max_drawdown: number
          period_end: string
          period_start: string
          profit_factor: number
          sharpe_ratio: number | null
          symbol: string
          timeframe: string
          total_trades: number
          user_id: string
          win_rate: number
          winning_trades: number
        }
        Insert: {
          avg_loss: number
          avg_win: number
          created_at?: string | null
          expectancy: number
          id?: string
          losing_trades: number
          max_drawdown: number
          period_end: string
          period_start: string
          profit_factor: number
          sharpe_ratio?: number | null
          symbol: string
          timeframe: string
          total_trades: number
          user_id: string
          win_rate: number
          winning_trades: number
        }
        Update: {
          avg_loss?: number
          avg_win?: number
          created_at?: string | null
          expectancy?: number
          id?: string
          losing_trades?: number
          max_drawdown?: number
          period_end?: string
          period_start?: string
          profit_factor?: number
          sharpe_ratio?: number | null
          symbol?: string
          timeframe?: string
          total_trades?: number
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
      user_exchange_keys: {
        Row: {
          api_key: string
          api_key_encrypted: string | null
          api_secret: string
          api_secret_encrypted: string | null
          created_at: string | null
          exchange: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key: string
          api_key_encrypted?: string | null
          api_secret: string
          api_secret_encrypted?: string | null
          created_at?: string | null
          exchange: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key?: string
          api_key_encrypted?: string | null
          api_secret?: string
          api_secret_encrypted?: string | null
          created_at?: string | null
          exchange?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      whale_activity: {
        Row: {
          created_at: string
          detected_at: string
          id: string
          impact_score: number | null
          is_institutional: boolean | null
          order_size_usd: number
          price: number
          side: string
          source: string | null
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detected_at?: string
          id?: string
          impact_score?: number | null
          is_institutional?: boolean | null
          order_size_usd: number
          price: number
          side: string
          source?: string | null
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          detected_at?: string
          id?: string
          impact_score?: number | null
          is_institutional?: boolean | null
          order_size_usd?: number
          price?: number
          side?: string
          source?: string | null
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_exchange_keys_decrypted: {
        Row: {
          api_key: string | null
          api_secret: string | null
          created_at: string | null
          exchange: string | null
          id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          api_key?: never
          api_secret?: never
          created_at?: string | null
          exchange?: string | null
          id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          api_key?: never
          api_secret?: never
          created_at?: string | null
          exchange?: string | null
          id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      check_user_exists: { Args: { email_to_check: string }; Returns: boolean }
      clean_old_football_cache: { Args: never; Returns: undefined }
      cleanup_stale_positions: {
        Args: { days_old?: number }
        Returns: {
          cleaned_id: string
          opened_at: string
          symbol: string
        }[]
      }
      decrypt_exchange_key: {
        Args: { encrypted_text: string }
        Returns: string
      }
      encrypt_exchange_key: { Args: { plaintext: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_position_stale: { Args: { position_id: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
