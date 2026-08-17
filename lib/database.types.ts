export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      daily_prompt_assignments: {
        Row: {
          created_at: string
          entry_date: string
          prompt_id: number
          refreshed_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_date: string
          prompt_id: number
          refreshed_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          prompt_id?: number
          refreshed_at?: string | null
          user_id?: string
        }
        Relationships: [{
          foreignKeyName: "daily_prompt_assignments_prompt_id_fkey"
          columns: ["prompt_id"]
          isOneToOne: false
          referencedRelation: "prompts"
          referencedColumns: ["id"]
        }]
      }
      email_deliveries: {
        Row: {
          attempts: number
          created_at: string
          id: string
          kind: string
          last_error_code: string | null
          next_attempt_at: string | null
          period_end: string
          period_start: string
          provider_id: string | null
          review_date: string
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          kind?: string
          last_error_code?: string | null
          next_attempt_at?: string | null
          period_end: string
          period_start: string
          provider_id?: string | null
          review_date: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          kind?: string
          last_error_code?: string | null
          next_attempt_at?: string | null
          period_end?: string
          period_start?: string
          provider_id?: string | null
          review_date?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          completed_at: string | null
          content: string
          content_rich: Json | null
          created_at: string
          entry_date: string
          id: string
          updated_at: string
          user_id: string
          version: number
          word_count: number
        }
        Insert: {
          completed_at?: string | null
          content?: string
          content_rich?: Json | null
          created_at?: string
          entry_date: string
          id?: string
          updated_at?: string
          user_id: string
          version?: number
          word_count?: number
        }
        Update: {
          completed_at?: string | null
          content?: string
          content_rich?: Json | null
          created_at?: string
          entry_date?: string
          id?: string
          updated_at?: string
          user_id?: string
          version?: number
          word_count?: number
        }
        Relationships: []
      }
      product_events: {
        Row: {
          dedupe_key: string
          entry_date: string | null
          event_name: string
          id: number
          occurred_at: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          dedupe_key: string
          entry_date?: string | null
          event_name: string
          id?: number
          occurred_at?: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          dedupe_key?: string
          entry_date?: string | null
          event_name?: string
          id?: number
          occurred_at?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          daily_prompts_enabled: boolean
          habit_onboarding_completed: boolean
          last_welcome_back_date: string | null
          timezone: string
          updated_at: string
          user_id: string
          weekly_review_day: number
          weekly_review_enabled: boolean
          weekly_review_time: string
        }
        Insert: {
          created_at?: string
          daily_prompts_enabled?: boolean
          habit_onboarding_completed?: boolean
          last_welcome_back_date?: string | null
          timezone: string
          updated_at?: string
          user_id: string
          weekly_review_day?: number
          weekly_review_enabled?: boolean
          weekly_review_time?: string
        }
        Update: {
          created_at?: string
          daily_prompts_enabled?: boolean
          habit_onboarding_completed?: boolean
          last_welcome_back_date?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
          weekly_review_day?: number
          weekly_review_enabled?: boolean
          weekly_review_time?: string
        }
        Relationships: []
      }
      prompts: {
        Row: {
          active: boolean
          body: string
          category: string
          created_at: string
          id: number
        }
        Insert: {
          active?: boolean
          body: string
          category: string
          created_at?: string
          id?: number
        }
        Update: {
          active?: boolean
          body?: string
          category?: string
          created_at?: string
          id?: number
        }
        Relationships: []
      }
    }
    Views: {
      product_metrics_daily: {
        Row: {
          actor_count: number | null
          event_count: number | null
          event_date: string | null
          event_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_due_weekly_reviews: {
        Args: { p_limit?: number; p_now?: string }
        Returns: {
          current_streak: number
          delivery_id: string
          email: string
          month_completed: number
          month_words: number
          period_end: string
          period_start: string
          review_date: string
          timezone: string
          user_id: string
          week_completed: number
          week_words: number
          year_completed: number
          year_words: number
        }[]
      }
      finish_weekly_review: {
        Args: { p_delivery_id: string; p_error_code?: string; p_provider_id?: string }
        Returns: undefined
      }
      get_daily_prompt: {
        Args: { p_entry_date: string; p_refresh?: boolean }
        Returns: {
          active: boolean
          body: string
          category: string
          created_at: string
          id: number
        }
        SetofOptions: {
          from: "*"
          to: "prompts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_entry_history: {
        Args: {
          p_before_date?: string | null
          p_from_date?: string | null
          p_limit?: number
          p_query?: string | null
          p_to_date?: string | null
        }
        Returns: Json
      }
      get_habit_dashboard: { Args: { p_month?: string }; Returns: Json }
      habit_streaks: {
        Args: { p_today: string; p_user_id: string }
        Returns: { current_streak: number; longest_streak: number }[]
      }
      is_valid_timezone: { Args: { value: string }; Returns: boolean }
      mark_welcome_back: { Args: { p_entry_date: string }; Returns: string }
      record_product_event: {
        Args: { p_entry_date?: string; p_event_name: string; p_session_id?: string }
        Returns: boolean
      }
      save_entry: {
        Args: {
          p_content: string
          p_entry_date: string
          p_expected_version: number
          p_word_count: number
        }
        Returns: Json
      }
      save_rich_entry: {
        Args: {
          p_content: string
          p_content_rich: Json
          p_entry_date: string
          p_expected_version: number
          p_word_count: number
        }
        Returns: Json
      }
      set_habit_preferences: {
        Args: {
          p_daily_prompts_enabled: boolean
          p_habit_onboarding_completed: boolean
          p_weekly_review_day: number
          p_weekly_review_enabled: boolean
          p_weekly_review_time: string
        }
        Returns: {
          created_at: string
          daily_prompts_enabled: boolean
          habit_onboarding_completed: boolean
          last_welcome_back_date: string | null
          timezone: string
          updated_at: string
          user_id: string
          weekly_review_day: number
          weekly_review_enabled: boolean
          weekly_review_time: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_profile_timezone: {
        Args: { p_timezone: string }
        Returns: {
          created_at: string
          daily_prompts_enabled: boolean
          habit_onboarding_completed: boolean
          last_welcome_back_date: string | null
          timezone: string
          updated_at: string
          user_id: string
          weekly_review_day: number
          weekly_review_enabled: boolean
          weekly_review_time: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
