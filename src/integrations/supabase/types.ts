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
      compile_requests: {
        Row: {
          completed_at: string | null
          error_lines: Json | null
          id: string
          log: string | null
          pdf_path: string | null
          pending_tool_results: Json | null
          project_id: string
          reason: string | null
          request_compile_tool_use_id: string | null
          requested_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_lines?: Json | null
          id?: string
          log?: string | null
          pdf_path?: string | null
          pending_tool_results?: Json | null
          project_id: string
          reason?: string | null
          request_compile_tool_use_id?: string | null
          requested_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          error_lines?: Json | null
          id?: string
          log?: string | null
          pdf_path?: string | null
          pending_tool_results?: Json | null
          project_id?: string
          reason?: string | null
          request_compile_tool_use_id?: string | null
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "compile_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          created_at: string
          handled_at: string | null
          id: string
          items: Json
          project_id: string
          title: string | null
          tool_use_id: string
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          id?: string
          items?: Json
          project_id: string
          title?: string | null
          tool_use_id: string
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          id?: string
          items?: Json
          project_id?: string
          title?: string | null
          tool_use_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibit_cache: {
        Row: {
          exhibit_id: string
          extracted_text: string | null
          updated_at: string
        }
        Insert: {
          exhibit_id: string
          extracted_text?: string | null
          updated_at?: string
        }
        Update: {
          exhibit_id?: string
          extracted_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibit_cache_exhibit_id_fkey"
            columns: ["exhibit_id"]
            isOneToOne: true
            referencedRelation: "exhibits"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibits: {
        Row: {
          ai_recommendation: Json | null
          created_at: string
          id: string
          included_pages: number[] | null
          label: string
          mime_type: string
          order_index: number
          original_filename: string | null
          original_page_count: number | null
          original_storage_path: string | null
          page_count: number | null
          project_id: string
          review_status: string
          size_bytes: number | null
          storage_path: string | null
          tags: string[]
          title: string
          trimmed_at: string | null
        }
        Insert: {
          ai_recommendation?: Json | null
          created_at?: string
          id?: string
          included_pages?: number[] | null
          label: string
          mime_type?: string
          order_index?: number
          original_filename?: string | null
          original_page_count?: number | null
          original_storage_path?: string | null
          page_count?: number | null
          project_id: string
          review_status?: string
          size_bytes?: number | null
          storage_path?: string | null
          tags?: string[]
          title?: string
          trimmed_at?: string | null
        }
        Update: {
          ai_recommendation?: Json | null
          created_at?: string
          id?: string
          included_pages?: number[] | null
          label?: string
          mime_type?: string
          order_index?: number
          original_filename?: string | null
          original_page_count?: number | null
          original_storage_path?: string | null
          page_count?: number | null
          project_id?: string
          review_status?: string
          size_bytes?: number | null
          storage_path?: string | null
          tags?: string[]
          title?: string
          trimmed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exhibits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          created_at: string
          founded_year: number | null
          hq: string | null
          id: string
          is_active: boolean
          is_partner: boolean
          kind: string
          logo_url: string | null
          name: string
          notes: string | null
          offices: string | null
          partner_blurb: string | null
          partner_discount_label: string | null
          partner_min_discount_pct: number | null
          price_high_usd: number | null
          price_label: string
          price_low_usd: number | null
          slug: string
          sort_order: number
          success_rate_label: string | null
          transparency: string
          updated_at: string
          visa_types: string[]
          website_url: string | null
        }
        Insert: {
          created_at?: string
          founded_year?: number | null
          hq?: string | null
          id?: string
          is_active?: boolean
          is_partner?: boolean
          kind: string
          logo_url?: string | null
          name: string
          notes?: string | null
          offices?: string | null
          partner_blurb?: string | null
          partner_discount_label?: string | null
          partner_min_discount_pct?: number | null
          price_high_usd?: number | null
          price_label?: string
          price_low_usd?: number | null
          slug: string
          sort_order?: number
          success_rate_label?: string | null
          transparency?: string
          updated_at?: string
          visa_types?: string[]
          website_url?: string | null
        }
        Update: {
          created_at?: string
          founded_year?: number | null
          hq?: string | null
          id?: string
          is_active?: boolean
          is_partner?: boolean
          kind?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          offices?: string | null
          partner_blurb?: string | null
          partner_discount_label?: string | null
          partner_min_discount_pct?: number | null
          price_high_usd?: number | null
          price_label?: string
          price_low_usd?: number | null
          slug?: string
          sort_order?: number
          success_rate_label?: string | null
          transparency?: string
          updated_at?: string
          visa_types?: string[]
          website_url?: string | null
        }
        Relationships: []
      }
      letter_events: {
        Row: {
          actor: string
          created_at: string
          id: string
          letter_id: string
          payload: Json
          type: string
        }
        Insert: {
          actor?: string
          created_at?: string
          id?: string
          letter_id: string
          payload?: Json
          type: string
        }
        Update: {
          actor?: string
          created_at?: string
          id?: string
          letter_id?: string
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_events_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          letter_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          letter_id: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          letter_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_tokens_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      letters: {
        Row: {
          body_md: string
          created_at: string
          exhibit_id: string | null
          id: string
          notes: string
          project_id: string
          recommender_email: string
          recommender_name: string
          recommender_org: string
          recommender_title: string
          relationship: string
          signature_data_url: string | null
          signature_image_path: string | null
          signed_at: string | null
          signed_name: string | null
          signer_ip_hash: string | null
          signer_user_agent: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_md?: string
          created_at?: string
          exhibit_id?: string | null
          id?: string
          notes?: string
          project_id: string
          recommender_email?: string
          recommender_name?: string
          recommender_org?: string
          recommender_title?: string
          relationship?: string
          signature_data_url?: string | null
          signature_image_path?: string | null
          signed_at?: string | null
          signed_name?: string | null
          signer_ip_hash?: string | null
          signer_user_agent?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Update: {
          body_md?: string
          created_at?: string
          exhibit_id?: string | null
          id?: string
          notes?: string
          project_id?: string
          recommender_email?: string
          recommender_name?: string
          recommender_org?: string
          recommender_title?: string
          relationship?: string
          signature_data_url?: string | null
          signature_image_path?: string | null
          signed_at?: string | null
          signed_name?: string | null
          signer_ip_hash?: string | null
          signer_user_agent?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "letters_exhibit_id_fkey"
            columns: ["exhibit_id"]
            isOneToOne: false
            referencedRelation: "exhibits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: Json
          created_at: string
          id: string
          project_id: string
          role: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          project_id: string
          role: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          project_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_firms: {
        Row: {
          blurb: string
          created_at: string
          discount_label: string
          id: string
          is_active: boolean
          location: string | null
          min_discount_pct: number | null
          name: string
          sort_order: number
          updated_at: string
          visa_types: string[]
          website_url: string | null
        }
        Insert: {
          blurb?: string
          created_at?: string
          discount_label: string
          id?: string
          is_active?: boolean
          location?: string | null
          min_discount_pct?: number | null
          name: string
          sort_order?: number
          updated_at?: string
          visa_types?: string[]
          website_url?: string | null
        }
        Update: {
          blurb?: string
          created_at?: string
          discount_label?: string
          id?: string
          is_active?: boolean
          location?: string | null
          min_discount_pct?: number | null
          name?: string
          sort_order?: number
          updated_at?: string
          visa_types?: string[]
          website_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bypass_billing: boolean
          created_at: string
          display_name: string | null
          marketing_opt_out: boolean
          onboarded_at: string | null
          stripe_connect_account_id: string | null
          unsubscribe_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bypass_billing?: boolean
          created_at?: string
          display_name?: string | null
          marketing_opt_out?: boolean
          onboarded_at?: string | null
          stripe_connect_account_id?: string | null
          unsubscribe_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bypass_billing?: boolean
          created_at?: string
          display_name?: string | null
          marketing_opt_out?: boolean
          onboarded_at?: string | null
          stripe_connect_account_id?: string | null
          unsubscribe_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_billing: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string
          free_messages_used: number
          paid_at: string | null
          project_id: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          token_budget: number
          tokens_used: number
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string
          free_messages_used?: number
          paid_at?: string | null
          project_id: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          token_budget?: number
          tokens_used?: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string
          free_messages_used?: number
          paid_at?: string | null
          project_id?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          token_budget?: number
          tokens_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_billing_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          ai_mode: string
          beneficiary_name: string | null
          byok_key_ciphertext: string | null
          byok_key_last4: string | null
          byok_provider: string | null
          byok_verified_at: string | null
          created_at: string
          editor_mode: string
          field: string | null
          id: string
          name: string
          owner_id: string
          profile_data: Json
          ref_code: string | null
          ref_locked_at: string | null
          strategy_md: string
          theme: Json
          updated_at: string
          visa_type: string
        }
        Insert: {
          ai_mode?: string
          beneficiary_name?: string | null
          byok_key_ciphertext?: string | null
          byok_key_last4?: string | null
          byok_provider?: string | null
          byok_verified_at?: string | null
          created_at?: string
          editor_mode?: string
          field?: string | null
          id?: string
          name: string
          owner_id: string
          profile_data?: Json
          ref_code?: string | null
          ref_locked_at?: string | null
          strategy_md?: string
          theme?: Json
          updated_at?: string
          visa_type: string
        }
        Update: {
          ai_mode?: string
          beneficiary_name?: string | null
          byok_key_ciphertext?: string | null
          byok_key_last4?: string | null
          byok_provider?: string | null
          byok_verified_at?: string | null
          created_at?: string
          editor_mode?: string
          field?: string | null
          id?: string
          name?: string
          owner_id?: string
          profile_data?: Json
          ref_code?: string | null
          ref_locked_at?: string | null
          strategy_md?: string
          theme?: Json
          updated_at?: string
          visa_type?: string
        }
        Relationships: []
      }
      section_suggestions: {
        Row: {
          author_role: string
          author_user_id: string
          base_version_id: string | null
          created_at: string
          hunks: Json
          id: string
          project_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          section_id: string
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          author_role?: string
          author_user_id: string
          base_version_id?: string | null
          created_at?: string
          hunks?: Json
          id?: string
          project_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          section_id: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          author_role?: string
          author_user_id?: string
          base_version_id?: string | null
          created_at?: string
          hunks?: Json
          id?: string
          project_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          section_id?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_suggestions_base_version_id_fkey"
            columns: ["base_version_id"]
            isOneToOne: false
            referencedRelation: "section_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_suggestions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_suggestions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      section_versions: {
        Row: {
          author_role: string
          author_user_id: string | null
          created_at: string
          id: string
          note: string | null
          parent_version_id: string | null
          project_id: string
          section_id: string
          source: string
          tex_body: string
          version_number: number
        }
        Insert: {
          author_role?: string
          author_user_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          parent_version_id?: string | null
          project_id: string
          section_id: string
          source?: string
          tex_body: string
          version_number: number
        }
        Update: {
          author_role?: string
          author_user_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          parent_version_id?: string | null
          project_id?: string
          section_id?: string
          source?: string
          tex_body?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "section_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "section_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_versions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          created_at: string
          id: string
          order_index: number
          project_id: string
          section_key: string
          tex_body: string
          title: string
          updated_at: string
          updated_by_source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          project_id: string
          section_key: string
          tex_body?: string
          title?: string
          updated_at?: string
          updated_by_source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          project_id?: string
          section_key?: string
          tex_body?: string
          title?: string
          updated_at?: string
          updated_by_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_comments: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          project_id: string
          suggestion_id: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          project_id: string
          suggestion_id: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_comments_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "section_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          created_at: string
          extracted_text: string | null
          id: string
          kind: string
          mime_type: string
          project_id: string
          request_id: string | null
          size_bytes: number | null
          slot_key: string | null
          storage_path: string | null
          title: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          kind?: string
          mime_type?: string
          project_id: string
          request_id?: string | null
          size_bytes?: number | null
          slot_key?: string | null
          storage_path?: string | null
          title: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          kind?: string
          mime_type?: string
          project_id?: string
          request_id?: string | null
          size_bytes?: number | null
          slot_key?: string | null
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploads_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_case_tokens: {
        Args: { _in: number; _out: number; _project_id: string }
        Returns: number
      }
      create_free_project:
        | {
            Args: {
              _beneficiary_name?: string
              _field?: string
              _name: string
              _visa_type: string
            }
            Returns: string
          }
        | {
            Args: {
              _beneficiary_name?: string
              _field?: string
              _name: string
              _ref_code?: string
              _visa_type: string
            }
            Returns: string
          }
      increment_free_message: { Args: { _project_id: string }; Returns: number }
      letter_public_sign_pdf: {
        Args: {
          _ip_hash: string
          _name: string
          _sig_data_url: string
          _token: string
          _ua: string
        }
        Returns: Json
      }
      reorder_sections: {
        Args: { _ordered_ids: string[]; _project_id: string }
        Returns: undefined
      }
      restore_section_version: {
        Args: { _note?: string; _version_id: string }
        Returns: Json
      }
      set_section_body: {
        Args: {
          _note?: string
          _role?: string
          _section_id: string
          _source?: string
          _tex_body: string
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
