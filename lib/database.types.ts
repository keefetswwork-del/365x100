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
        Relationships: [
          {
            foreignKeyName: "daily_prompt_assignments_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
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
          writing_year_id: string
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
          writing_year_id: string
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
          writing_year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_writing_year_id_fkey"
            columns: ["writing_year_id"]
            isOneToOne: false
            referencedRelation: "writing_years"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_media: {
        Row: {
          byte_size: number
          created_at: string
          entry_id: string
          height: number
          id: string
          mime_type: string
          operation_id: string
          storage_path: string
          updated_at: string
          user_id: string
          version: number
          width: number
        }
        Insert: {
          byte_size: number
          created_at?: string
          entry_id: string
          height: number
          id?: string
          mime_type?: string
          operation_id: string
          storage_path: string
          updated_at?: string
          user_id: string
          version?: number
          width: number
        }
        Update: {
          byte_size?: number
          created_at?: string
          entry_id?: string
          height?: number
          id?: string
          mime_type?: string
          operation_id?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
          version?: number
          width?: number
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          document_type: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          document_type: string
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          document_type?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_document_type_version_fkey"
            columns: ["document_type", "version"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["document_type", "version"]
          },
        ]
      }
      legal_document_versions: {
        Row: {
          account_gate_from: string | null
          created_at: string
          document_type: string
          effective_date: string
          is_current: boolean
          version: string
        }
        Insert: {
          account_gate_from?: string | null
          created_at?: string
          document_type: string
          effective_date: string
          is_current?: boolean
          version: string
        }
        Update: {
          account_gate_from?: string | null
          created_at?: string
          document_type?: string
          effective_date?: string
          is_current?: boolean
          version?: string
        }
        Relationships: []
      }
      media_cleanup_queue: {
        Row: {
          attempts: number
          created_at: string
          id: number
          last_error_code: string | null
          next_attempt_at: string
          reason: string
          storage_path: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: number
          last_error_code?: string | null
          next_attempt_at?: string
          reason: string
          storage_path: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: number
          last_error_code?: string | null
          next_attempt_at?: string
          reason?: string
          storage_path?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      media_entitlements: {
        Row: {
          expires_at: string | null
          granted_at: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      media_events: {
        Row: {
          dedupe_key: string
          duration_bucket: string | null
          entitlement: string
          entry_date: string | null
          event_name: string
          failure_category: string | null
          id: number
          occurred_at: string
          operation_id: string
          size_bucket: string | null
          user_id: string
        }
        Insert: {
          dedupe_key: string
          duration_bucket?: string | null
          entitlement: string
          entry_date?: string | null
          event_name: string
          failure_category?: string | null
          id?: number
          occurred_at?: string
          operation_id: string
          size_bucket?: string | null
          user_id: string
        }
        Update: {
          dedupe_key?: string
          duration_bucket?: string | null
          entitlement?: string
          entry_date?: string | null
          event_name?: string
          failure_category?: string | null
          id?: number
          occurred_at?: string
          operation_id?: string
          size_bucket?: string | null
          user_id?: string
        }
        Relationships: []
      }
      operational_events: {
        Row: {
          dedupe_key: string
          error_code: string
          feature_area: string
          id: number
          occurred_at: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          dedupe_key: string
          error_code: string
          feature_area: string
          id?: number
          occurred_at?: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          dedupe_key?: string
          error_code?: string
          feature_area?: string
          id?: number
          occurred_at?: string
          session_id?: string | null
          user_id?: string | null
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
      writing_years: {
        Row: {
          created_at: string
          end_date: string
          id: string
          start_date: string
          user_id: string
          year_number: number
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          user_id: string
          year_number: number
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          user_id?: string
          year_number?: number
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
      accept_media_privacy: { Args: never; Returns: Json }
      accept_current_legal_documents: { Args: never; Returns: Json }
      commit_entry_media: {
        Args: {
          p_byte_size: number
          p_entry_id: string
          p_expected_media_id?: string | null
          p_expected_version?: number | null
          p_height: number
          p_media_id: string
          p_operation_id: string
          p_storage_path: string
          p_user_id: string
          p_width: number
        }
        Returns: Json
      }
      complete_media_cleanup: { Args: { p_storage_paths: string[] }; Returns: undefined }
      current_media_tier: { Args: { p_user_id: string }; Returns: string }
      claim_due_weekly_reviews: {
        Args: { p_limit?: number; p_now?: string }
        Returns: {
          current_streak: number
          delivery_id: string
          email: string
          month_completed: number
          month_writing_days: number
          month_words: number
          most_recent_writing_date: string | null
          period_end: string
          period_start: string
          personal_year_words: number
          personal_year_writing_days: number
          review_date: string
          timezone: string
          user_id: string
          week_completed: number
          week_writing_days: number
          week_words: number
          year_completed: number
          year_words: number
        }[]
      }
      ensure_writing_year_for_date: {
        Args: { p_entry_date: string; p_user_id: string }
        Returns: string
      }
      entry_has_visible_content: { Args: { p_content: string }; Returns: boolean }
      finish_weekly_review: {
        Args: {
          p_delivery_id: string
          p_error_code?: string
          p_provider_id?: string
        }
        Returns: undefined
      }
      get_current_legal_status: { Args: never; Returns: Json }
      get_media_account_status: { Args: never; Returns: Json }
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
          p_before_date?: string
          p_from_date?: string
          p_limit?: number
          p_query?: string
          p_to_date?: string
        }
        Returns: Json
      }
      get_habit_dashboard: { Args: { p_month?: string }; Returns: Json }
      get_writing_year_dashboard: { Args: never; Returns: Json }
      habit_streaks: {
        Args: { p_today: string; p_user_id: string }
        Returns: {
          current_streak: number
          longest_streak: number
        }[]
      }
      is_valid_rich_entry: { Args: { value: Json }; Returns: boolean }
      is_valid_timezone: { Args: { value: string }; Returns: boolean }
      mark_welcome_back: { Args: { p_entry_date: string }; Returns: string }
      media_cleanup_candidates: {
        Args: { p_limit?: number }
        Returns: { attempts: number; storage_path: string }[]
      }
      orphaned_media_objects: {
        Args: { p_limit?: number }
        Returns: { storage_path: string }[]
      }
      record_media_event: {
        Args: {
          p_duration_bucket?: string | null
          p_entry_date?: string | null
          p_event_name: string
          p_failure_category?: string | null
          p_operation_id: string
          p_size_bucket?: string | null
        }
        Returns: boolean
      }
      record_operational_event: {
        Args: {
          p_error_code: string
          p_feature_area: string
          p_session_id?: string
        }
        Returns: boolean
      }
      record_product_event: {
        Args: {
          p_entry_date?: string
          p_event_name: string
          p_session_id?: string
        }
        Returns: boolean
      }
      remove_entry_media: {
        Args: { p_expected_version: number; p_media_id: string; p_user_id: string }
        Returns: Json
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
