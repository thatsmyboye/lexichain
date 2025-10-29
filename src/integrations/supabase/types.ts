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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      consumable_transactions: {
        Row: {
          consumable_id: string
          created_at: string
          game_result_id: string | null
          id: string
          quantity: number
          source: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          consumable_id: string
          created_at?: string
          game_result_id?: string | null
          id?: string
          quantity: number
          source?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          consumable_id?: string
          created_at?: string
          game_result_id?: string | null
          id?: string
          quantity?: number
          source?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_result"
            columns: ["game_result_id"]
            isOneToOne: false
            referencedRelation: "standard_game_results"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_challenge_board_analysis: {
        Row: {
          avg_word_length: number
          challenge_date: string
          connectivity_score: number
          created_at: string | null
          grid_size: number
          letter_distribution: Json
          max_score_potential: number
          rarity_score_potential: number
          word_count: number
        }
        Insert: {
          avg_word_length?: number
          challenge_date: string
          connectivity_score?: number
          created_at?: string | null
          grid_size?: number
          letter_distribution?: Json
          max_score_potential?: number
          rarity_score_potential?: number
          word_count: number
        }
        Update: {
          avg_word_length?: number
          challenge_date?: string
          connectivity_score?: number
          created_at?: string | null
          grid_size?: number
          letter_distribution?: Json
          max_score_potential?: number
          rarity_score_potential?: number
          word_count?: number
        }
        Relationships: []
      }
      daily_challenge_results: {
        Row: {
          achievement_level: string
          board_analysis: Json | null
          challenge_date: string
          created_at: string
          grid_size: number | null
          id: string
          score: number
          updated_at: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          achievement_level: string
          board_analysis?: Json | null
          challenge_date: string
          created_at?: string
          grid_size?: number | null
          id?: string
          score: number
          updated_at?: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          achievement_level?: string
          board_analysis?: Json | null
          challenge_date?: string
          created_at?: string
          grid_size?: number | null
          id?: string
          score?: number
          updated_at?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: []
      }
      daily_challenge_states: {
        Row: {
          challenge_date: string
          created_at: string
          game_state: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_date: string
          created_at?: string
          game_state: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_date?: string
          created_at?: string
          game_state?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_login_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_login_date: string
          total_logins: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_login_date: string
          total_logins?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_login_date?: string
          total_logins?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_progress: {
        Row: {
          created_at: string
          game_result_id: string | null
          goal_id: string
          id: string
          progress_data: Json | null
          progress_increment: number
        }
        Insert: {
          created_at?: string
          game_result_id?: string | null
          goal_id: string
          id?: string
          progress_data?: Json | null
          progress_increment?: number
        }
        Update: {
          created_at?: string
          game_result_id?: string | null
          goal_id?: string
          id?: string
          progress_data?: Json | null
          progress_increment?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_game_result_id_fkey"
            columns: ["game_result_id"]
            isOneToOne: false
            referencedRelation: "standard_game_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "player_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_rewards: {
        Row: {
          created_at: string
          id: string
          leaderboard_type: string
          period: string
          rank: number
          rewards_given: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leaderboard_type: string
          period: string
          rank: number
          rewards_given: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leaderboard_type?: string
          period?: string
          rank?: number
          rewards_given?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      player_goals: {
        Row: {
          completed_at: string | null
          created_at: string
          current_progress: number
          expires_at: string | null
          goal_data: Json | null
          goal_id: string
          id: string
          started_at: string
          status: string | null
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_progress?: number
          expires_at?: string | null
          goal_data?: Json | null
          goal_id: string
          id?: string
          started_at?: string
          status?: string | null
          target_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_progress?: number
          expires_at?: string | null
          goal_data?: Json | null
          goal_id?: string
          id?: string
          started_at?: string
          status?: string | null
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          client_ip: unknown
          created_at: string
          event_details: Json | null
          event_level: string
          event_type: string
          id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          client_ip?: unknown
          created_at?: string
          event_details?: Json | null
          event_level: string
          event_type: string
          id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          client_ip?: unknown
          created_at?: string
          event_details?: Json | null
          event_level?: string
          event_type?: string
          id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      standard_game_results: {
        Row: {
          achievement_grade: string | null
          achievements_unlocked: string[] | null
          created_at: string
          game_mode: string
          grid_size: number
          id: string
          longest_word: string | null
          moves_used: number
          score: number
          time_played: number | null
          updated_at: string
          user_id: string
          words_found: number
        }
        Insert: {
          achievement_grade?: string | null
          achievements_unlocked?: string[] | null
          created_at?: string
          game_mode?: string
          grid_size?: number
          id?: string
          longest_word?: string | null
          moves_used?: number
          score: number
          time_played?: number | null
          updated_at?: string
          user_id: string
          words_found?: number
        }
        Update: {
          achievement_grade?: string | null
          achievements_unlocked?: string[] | null
          created_at?: string
          game_mode?: string
          grid_size?: number
          id?: string
          longest_word?: string | null
          moves_used?: number
          score?: number
          time_played?: number | null
          updated_at?: string
          user_id?: string
          words_found?: number
        }
        Relationships: []
      }
      user_consumables: {
        Row: {
          consumable_id: string
          created_at: string
          id: string
          last_used: string | null
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          consumable_id: string
          created_at?: string
          id?: string
          last_used?: string | null
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          consumable_id?: string
          created_at?: string
          id?: string
          last_used?: string | null
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_unlocked_modes: {
        Row: {
          id: string
          mode_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          mode_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          mode_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_daily_challenge_benchmarks: {
        Args: { days_back?: number; target_challenge_date: string }
        Returns: {
          avg_score: number
          bronze_percentile: number
          gold_percentile: number
          max_score: number
          min_score: number
          platinum_percentile: number
          silver_percentile: number
          total_scores: number
        }[]
      }
      cleanup_unconfirmed_users: { Args: never; Returns: undefined }
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      distribute_daily_leaderboard_rewards: {
        Args: { target_date: string }
        Returns: Json
      }
      distribute_monthly_leaderboard_rewards: {
        Args: { target_month: number; target_year: number }
        Returns: Json
      }
      distribute_weekly_leaderboard_rewards: {
        Args: { target_week_start: string }
        Returns: Json
      }
      get_benchmark_data: { Args: { challenge_date: string }; Returns: Json }
      get_daily_leaderboard: {
        Args: { challenge_date: string }
        Returns: {
          display_name: string
          rank: number
          score: number
          user_id: string
        }[]
      }
      get_enhanced_benchmark_data: {
        Args: { challenge_date: string }
        Returns: Json
      }
      get_monthly_leaderboard: {
        Args: { month: number; year: number }
        Returns: {
          best_score: number
          display_name: string
          rank: number
          user_id: string
        }[]
      }
      get_week_start: { Args: { input_date?: string }; Returns: string }
      get_weekly_leaderboard: {
        Args: { week_start: string }
        Returns: {
          best_score: number
          display_name: string
          rank: number
          user_id: string
        }[]
      }
      grant_admin_role: { Args: { target_user_id: string }; Returns: undefined }
      grant_starter_consumables: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_security_event: {
        Args: { event_details?: Json; event_level?: string; event_type: string }
        Returns: undefined
      }
      save_daily_challenge_board_analysis: {
        Args: {
          avg_word_length: number
          challenge_date: string
          connectivity_score: number
          grid_size: number
          letter_distribution: Json
          max_score_potential: number
          rarity_score_potential: number
          word_count: number
        }
        Returns: undefined
      }
      validate_admin_action: {
        Args: { action_type: string; target_user_id?: string }
        Returns: boolean
      }
      validate_audit_log_access: { Args: never; Returns: boolean }
      validate_display_name_server_side: {
        Args: { display_name: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
