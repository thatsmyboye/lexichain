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
    PostgrestVersion: "13.0.4"
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
      daily_challenge_results: {
        Row: {
          achievement_level: string
          challenge_date: string
          created_at: string
          id: string
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_level: string
          challenge_date: string
          created_at?: string
          id?: string
          score: number
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_level?: string
          challenge_date?: string
          created_at?: string
          id?: string
          score?: number
          updated_at?: string
          user_id?: string
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
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_unconfirmed_users: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
