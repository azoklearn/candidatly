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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          cover_letter_diff: Json | null
          cover_letter_text: string | null
          created_at: string
          external_application_id: string | null
          generation_model: string | null
          generation_tokens: Json | null
          id: string
          match_id: string | null
          next_follow_up_at: string | null
          notes: string | null
          offer_id: string
          regeneration_count: number
          sent_at: string | null
          sent_via: Database["public"]["Enums"]["applications_sent_via"] | null
          status: Database["public"]["Enums"]["applications_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_letter_diff?: Json | null
          cover_letter_text?: string | null
          created_at?: string
          external_application_id?: string | null
          generation_model?: string | null
          generation_tokens?: Json | null
          id?: string
          match_id?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          offer_id: string
          regeneration_count?: number
          sent_at?: string | null
          sent_via?: Database["public"]["Enums"]["applications_sent_via"] | null
          status?: Database["public"]["Enums"]["applications_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_letter_diff?: Json | null
          cover_letter_text?: string | null
          created_at?: string
          external_application_id?: string | null
          generation_model?: string | null
          generation_tokens?: Json | null
          id?: string
          match_id?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          offer_id?: string
          regeneration_count?: number
          sent_at?: string | null
          sent_via?: Database["public"]["Enums"]["applications_sent_via"] | null
          status?: Database["public"]["Enums"]["applications_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          brand_name: string | null
          city: string | null
          confidence: number | null
          created_at: string
          date_creation: string | null
          establishment_address: string | null
          establishment_city: string | null
          establishment_postal_code: string | null
          executives: Json
          headcount_range: string | null
          id: string
          legal_name: string | null
          naf_code: string | null
          naf_label: string | null
          naf25_code: string | null
          postal_code: string | null
          raw: Json | null
          siren: string
          siret: string
          source_updated_at: string | null
          summary: Json | null
          summary_generated_at: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          brand_name?: string | null
          city?: string | null
          confidence?: number | null
          created_at?: string
          date_creation?: string | null
          establishment_address?: string | null
          establishment_city?: string | null
          establishment_postal_code?: string | null
          executives?: Json
          headcount_range?: string | null
          id?: string
          legal_name?: string | null
          naf_code?: string | null
          naf_label?: string | null
          naf25_code?: string | null
          postal_code?: string | null
          raw?: Json | null
          siren: string
          siret: string
          source_updated_at?: string | null
          summary?: Json | null
          summary_generated_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          brand_name?: string | null
          city?: string | null
          confidence?: number | null
          created_at?: string
          date_creation?: string | null
          establishment_address?: string | null
          establishment_city?: string | null
          establishment_postal_code?: string | null
          executives?: Json
          headcount_range?: string | null
          id?: string
          legal_name?: string | null
          naf_code?: string | null
          naf_label?: string | null
          naf25_code?: string | null
          postal_code?: string | null
          raw?: Json | null
          siren?: string
          siret?: string
          source_updated_at?: string | null
          summary?: Json | null
          summary_generated_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          application_id: string | null
          created_at: string
          delta: number
          id: string
          reason: Database["public"]["Enums"]["credit_transactions_reason"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          delta: number
          id?: string
          reason: Database["public"]["Enums"]["credit_transactions_reason"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          reason?: Database["public"]["Enums"]["credit_transactions_reason"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          extracted_text: string | null
          id: string
          is_current: boolean
          kind: Database["public"]["Enums"]["documents_kind"]
          mime_type: string | null
          original_filename: string | null
          size_bytes: number | null
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          is_current?: boolean
          kind: Database["public"]["Enums"]["documents_kind"]
          mime_type?: string | null
          original_filename?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          is_current?: boolean
          kind?: Database["public"]["Enums"]["documents_kind"]
          mime_type?: string | null
          original_filename?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          id: string
          payload: Json
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          offer_id: string
          score: number
          score_reasons: Json
          status: Database["public"]["Enums"]["matches_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          offer_id: string
          score: number
          score_reasons?: Json
          status?: Database["public"]["Enums"]["matches_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          offer_id?: string
          score?: number
          score_reasons?: Json
          status?: Database["public"]["Enums"]["matches_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_search_runs: {
        Row: {
          created_at: string
          fetched_at: string
          id: string
          params: Json
          query_key: string
          result_count: number | null
          source: Database["public"]["Enums"]["offers_source"]
          status_code: number | null
          updated_at: string
          warnings: Json | null
        }
        Insert: {
          created_at?: string
          fetched_at?: string
          id?: string
          params: Json
          query_key: string
          result_count?: number | null
          source: Database["public"]["Enums"]["offers_source"]
          status_code?: number | null
          updated_at?: string
          warnings?: Json | null
        }
        Update: {
          created_at?: string
          fetched_at?: string
          id?: string
          params?: Json
          query_key?: string
          result_count?: number | null
          source?: Database["public"]["Enums"]["offers_source"]
          status_code?: number | null
          updated_at?: string
          warnings?: Json | null
        }
        Relationships: []
      }
      offers: {
        Row: {
          apply_channel: Database["public"]["Enums"]["offers_apply_channel"]
          apply_target: string
          company_name: string | null
          company_siret: string | null
          company_website: string | null
          contract_types: string[]
          created_at: string
          description: string | null
          diploma_level: number | null
          expires_at: string | null
          external_id: string
          id: string
          insee_code: string | null
          is_delegated: boolean
          last_seen_at: string
          lat: number | null
          lng: number | null
          location_label: string | null
          postal_code: string | null
          published_at: string | null
          raw: Json
          removed_at: string | null
          rome_codes: string[]
          source: Database["public"]["Enums"]["offers_source"]
          title: string
          updated_at: string
        }
        Insert: {
          apply_channel: Database["public"]["Enums"]["offers_apply_channel"]
          apply_target: string
          company_name?: string | null
          company_siret?: string | null
          company_website?: string | null
          contract_types?: string[]
          created_at?: string
          description?: string | null
          diploma_level?: number | null
          expires_at?: string | null
          external_id: string
          id?: string
          insee_code?: string | null
          is_delegated?: boolean
          last_seen_at?: string
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          postal_code?: string | null
          published_at?: string | null
          raw: Json
          removed_at?: string | null
          rome_codes?: string[]
          source: Database["public"]["Enums"]["offers_source"]
          title: string
          updated_at?: string
        }
        Update: {
          apply_channel?: Database["public"]["Enums"]["offers_apply_channel"]
          apply_target?: string
          company_name?: string | null
          company_siret?: string | null
          company_website?: string | null
          contract_types?: string[]
          created_at?: string
          description?: string | null
          diploma_level?: number | null
          expires_at?: string | null
          external_id?: string
          id?: string
          insee_code?: string | null
          is_delegated?: boolean
          last_seen_at?: string
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          postal_code?: string | null
          published_at?: string | null
          raw?: Json
          removed_at?: string | null
          rome_codes?: string[]
          source?: Database["public"]["Enums"]["offers_source"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          availability_date: string | null
          created_at: string
          degree_label: string | null
          diploma_level:
            | Database["public"]["Enums"]["profiles_diploma_level"]
            | null
          domain_free_text: string | null
          email: string | null
          first_name: string | null
          id: string
          insee_code: string | null
          last_name: string | null
          location_label: string | null
          location_lat: number | null
          location_lng: number | null
          onboarding_completed: boolean
          phone: string | null
          rome_codes: string[]
          rome_version: number | null
          school: string | null
          search_radius_km: number
          target_contract: Database["public"]["Enums"]["profiles_target_contract"]
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_date?: string | null
          created_at?: string
          degree_label?: string | null
          diploma_level?:
            | Database["public"]["Enums"]["profiles_diploma_level"]
            | null
          domain_free_text?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          insee_code?: string | null
          last_name?: string | null
          location_label?: string | null
          location_lat?: number | null
          location_lng?: number | null
          onboarding_completed?: boolean
          phone?: string | null
          rome_codes?: string[]
          rome_version?: number | null
          school?: string | null
          search_radius_km?: number
          target_contract?: Database["public"]["Enums"]["profiles_target_contract"]
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_date?: string | null
          created_at?: string
          degree_label?: string | null
          diploma_level?:
            | Database["public"]["Enums"]["profiles_diploma_level"]
            | null
          domain_free_text?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          insee_code?: string | null
          last_name?: string | null
          location_label?: string | null
          location_lat?: number | null
          location_lng?: number | null
          onboarding_completed?: boolean
          phone?: string | null
          rome_codes?: string[]
          rome_version?: number | null
          school?: string | null
          search_radius_km?: number
          target_contract?: Database["public"]["Enums"]["profiles_target_contract"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rome_appellations: {
        Row: {
          classification: string
          code_ogr: number
          code_rome: string
          created_at: string
          id: string
          is_active: boolean
          label_long: string
          label_short: string
          peu_usite: boolean
          rome_version: number
          search_text: string
          search_vector: unknown
          updated_at: string
        }
        Insert: {
          classification: string
          code_ogr: number
          code_rome: string
          created_at?: string
          id?: string
          is_active?: boolean
          label_long: string
          label_short: string
          peu_usite?: boolean
          rome_version: number
          search_text?: string
          search_vector?: unknown
          updated_at?: string
        }
        Update: {
          classification?: string
          code_ogr?: number
          code_rome?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label_long?: string
          label_short?: string
          peu_usite?: boolean
          rome_version?: number
          search_text?: string
          search_vector?: unknown
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rome_appellations_code_rome_fkey"
            columns: ["code_rome"]
            isOneToOne: false
            referencedRelation: "rome_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "rome_appellations_rome_version_fkey"
            columns: ["rome_version"]
            isOneToOne: false
            referencedRelation: "rome_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      rome_codes: {
        Row: {
          code: string
          code_rome_parent: string | null
          created_at: string
          domaine_professionnel: string
          emploi_cadre: boolean | null
          emploi_reglemente: boolean | null
          id: string
          is_active: boolean
          label: string
          rome_version: number
          search_text: string
          search_vector: unknown
          transition_demo: boolean | null
          transition_eco: string | null
          transition_num: boolean | null
          updated_at: string
        }
        Insert: {
          code: string
          code_rome_parent?: string | null
          created_at?: string
          domaine_professionnel: string
          emploi_cadre?: boolean | null
          emploi_reglemente?: boolean | null
          id?: string
          is_active?: boolean
          label: string
          rome_version: number
          search_text?: string
          search_vector?: unknown
          transition_demo?: boolean | null
          transition_eco?: string | null
          transition_num?: boolean | null
          updated_at?: string
        }
        Update: {
          code?: string
          code_rome_parent?: string | null
          created_at?: string
          domaine_professionnel?: string
          emploi_cadre?: boolean | null
          emploi_reglemente?: boolean | null
          id?: string
          is_active?: boolean
          label?: string
          rome_version?: number
          search_text?: string
          search_vector?: unknown
          transition_demo?: boolean | null
          transition_eco?: string | null
          transition_num?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rome_codes_domaine_professionnel_fkey"
            columns: ["domaine_professionnel"]
            isOneToOne: false
            referencedRelation: "rome_domaines_professionnels"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "rome_codes_rome_version_fkey"
            columns: ["rome_version"]
            isOneToOne: false
            referencedRelation: "rome_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      rome_domaines_professionnels: {
        Row: {
          code: string
          created_at: string
          grand_domaine: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          grand_domaine: string
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          grand_domaine?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rome_domaines_professionnels_grand_domaine_fkey"
            columns: ["grand_domaine"]
            isOneToOne: false
            referencedRelation: "rome_grand_domaines"
            referencedColumns: ["code"]
          },
        ]
      }
      rome_grand_domaines: {
        Row: {
          code: string
          created_at: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      rome_versions: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          imported_at: string
          published_at: string | null
          updated_at: string
          validated_at: string | null
          version: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          imported_at?: string
          published_at?: string | null
          updated_at?: string
          validated_at?: string | null
          version: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          imported_at?: string
          published_at?: string | null
          updated_at?: string
          validated_at?: string | null
          version?: number
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          created_at: string
          id: string
          payload: Json
          processed_at: string | null
          stripe_event_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          processed_at?: string | null
          stripe_event_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          stripe_event_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          status: Database["public"]["Enums"]["subscriptions_status"]
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan: string
          status: Database["public"]["Enums"]["subscriptions_status"]
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: Database["public"]["Enums"]["subscriptions_status"]
          stripe_customer_id?: string
          stripe_subscription_id?: string
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
      grant_signup_bonus: { Args: never; Returns: number }
      search_rome_candidates: {
        Args: { p_limit?: number; p_terms: string[] }
        Returns: {
          appellations: string[]
          code: string
          label: string
          rank: number
        }[]
      }
    }
    Enums: {
      applications_sent_via:
        | "api_alternance"
        | "widget"
        | "partner_site"
        | "mail_client"
        | "gmail"
      applications_status:
        | "draft"
        | "ready"
        | "sent"
        | "viewed"
        | "replied_positive"
        | "replied_negative"
        | "no_answer"
        | "unknown"
      credit_transactions_reason:
        | "purchase"
        | "application_sent"
        | "refund"
        | "signup_bonus"
      documents_kind: "cv" | "cover_letter_base"
      matches_status: "new" | "saved" | "dismissed" | "applied"
      offers_apply_channel: "api_alternance" | "email" | "external_url"
      offers_source: "api_alternance" | "adzuna" | "france_travail"
      profiles_diploma_level: "bac" | "bac+2" | "bac+3" | "bac+4" | "bac+5"
      profiles_target_contract: "alternance" | "stage" | "both"
      subscriptions_status:
        | "incomplete"
        | "incomplete_expired"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "paused"
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
      applications_sent_via: [
        "api_alternance",
        "widget",
        "partner_site",
        "mail_client",
        "gmail",
      ],
      applications_status: [
        "draft",
        "ready",
        "sent",
        "viewed",
        "replied_positive",
        "replied_negative",
        "no_answer",
        "unknown",
      ],
      credit_transactions_reason: [
        "purchase",
        "application_sent",
        "refund",
        "signup_bonus",
      ],
      documents_kind: ["cv", "cover_letter_base"],
      matches_status: ["new", "saved", "dismissed", "applied"],
      offers_apply_channel: ["api_alternance", "email", "external_url"],
      offers_source: ["api_alternance", "adzuna", "france_travail"],
      profiles_diploma_level: ["bac", "bac+2", "bac+3", "bac+4", "bac+5"],
      profiles_target_contract: ["alternance", "stage", "both"],
      subscriptions_status: [
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
      ],
    },
  },
} as const
