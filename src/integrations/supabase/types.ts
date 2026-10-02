export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          bucket: string;
          request_count: number;
          updated_at: string;
          window_started_at: string;
        };
        Insert: {
          bucket: string;
          request_count?: number;
          updated_at?: string;
          window_started_at?: string;
        };
        Update: {
          bucket?: string;
          request_count?: number;
          updated_at?: string;
          window_started_at?: string;
        };
        Relationships: [];
      };
      advisors: {
        Row: {
          affiliation: string | null;
          bio: string | null;
          created_at: string;
          id: string;
          name: string;
          photo_url: string | null;
          position: number;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          affiliation?: string | null;
          bio?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          photo_url?: string | null;
          position?: number;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          affiliation?: string | null;
          bio?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          photo_url?: string | null;
          position?: number;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      chapters: {
        Row: {
          about: string | null;
          chapter_lead: string | null;
          chapter_lead_2: string | null;
          chapter_lead_2_email: string | null;
          chapter_lead_email: string | null;
          chapter_number: number;
          created_at: string;
          id: string;
          lead_photo_path: string | null;
          location: string | null;
          new_students_this_year: number;
          notes: string | null;
          school_name: string;
          slug: string | null;
          updated_at: string;
        };
        Insert: {
          about?: string | null;
          chapter_lead?: string | null;
          chapter_lead_2?: string | null;
          chapter_lead_2_email?: string | null;
          chapter_lead_email?: string | null;
          chapter_number: number;
          created_at?: string;
          id?: string;
          lead_photo_path?: string | null;
          location?: string | null;
          new_students_this_year?: number;
          notes?: string | null;
          school_name: string;
          slug?: string | null;
          updated_at?: string;
        };
        Update: {
          about?: string | null;
          chapter_lead?: string | null;
          chapter_lead_2?: string | null;
          chapter_lead_2_email?: string | null;
          chapter_lead_email?: string | null;
          chapter_number?: number;
          created_at?: string;
          id?: string;
          lead_photo_path?: string | null;
          location?: string | null;
          new_students_this_year?: number;
          notes?: string | null;
          school_name?: string;
          slug?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      editor_accounts: {
        Row: {
          approved_at: string | null;
          created_at: string;
          email: string;
          id: string;
          name: string;
          password_hash: string;
          password_salt: string;
          status: string;
          username: string;
        };
        Insert: {
          approved_at?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          name: string;
          password_hash: string;
          password_salt: string;
          status?: string;
          username: string;
        };
        Update: {
          approved_at?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          password_hash?: string;
          password_salt?: string;
          status?: string;
          username?: string;
        };
        Relationships: [];
      };
      editor_recommendations: {
        Row: {
          action: string;
          comments: string;
          created_at: string;
          editor_email: string;
          editor_name: string;
          id: string;
          reviewed_at: string | null;
          reviewed_by: string;
          staff_message: string;
          status: string;
          submission_id: string;
        };
        Insert: {
          action: string;
          comments?: string;
          created_at?: string;
          editor_email?: string;
          editor_name?: string;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string;
          staff_message?: string;
          status?: string;
          submission_id: string;
        };
        Update: {
          action?: string;
          comments?: string;
          created_at?: string;
          editor_email?: string;
          editor_name?: string;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string;
          staff_message?: string;
          status?: string;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "editor_recommendations_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "manuscript_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      editorial_team: {
        Row: {
          affiliation: string | null;
          bio: string | null;
          created_at: string;
          email: string | null;
          id: string;
          member_group: string;
          name: string;
          photo_path: string | null;
          position: number;
          role: string | null;
          updated_at: string;
        };
        Insert: {
          affiliation?: string | null;
          bio?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          member_group?: string;
          name: string;
          photo_path?: string | null;
          position?: number;
          role?: string | null;
          updated_at?: string;
        };
        Update: {
          affiliation?: string | null;
          bio?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          member_group?: string;
          name?: string;
          photo_path?: string | null;
          position?: number;
          role?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_ideas: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          student_email: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          student_email: string;
          title: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          student_email?: string;
          title?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          created_at: string;
          description: string | null;
          event_date: string | null;
          id: string;
          location: string | null;
          poster_url: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          event_date?: string | null;
          id?: string;
          location?: string | null;
          poster_url?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          event_date?: string | null;
          id?: string;
          location?: string | null;
          poster_url?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      guidance_videos: {
        Row: {
          created_at: string;
          embed_id: string;
          id: string;
          position: number;
          provider: string;
          title: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          embed_id: string;
          id?: string;
          position?: number;
          provider: string;
          title: string;
          url: string;
        };
        Update: {
          created_at?: string;
          embed_id?: string;
          id?: string;
          position?: number;
          provider?: string;
          title?: string;
          url?: string;
        };
        Relationships: [];
      };
      initial_reviewers: {
        Row: {
          active: boolean;
          assigned_count: number;
          auth_user_id: string | null;
          created_at: string;
          email: string;
          id: string;
          name: string;
          portal_enabled: boolean;
        };
        Insert: {
          active?: boolean;
          assigned_count?: number;
          auth_user_id?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          name: string;
          portal_enabled?: boolean;
        };
        Update: {
          active?: boolean;
          assigned_count?: number;
          auth_user_id?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          portal_enabled?: boolean;
        };
        Relationships: [];
      };
      library_entries: {
        Row: {
          abstract: string | null;
          added_at: string;
          author_email: string | null;
          authors: string;
          award_label: string | null;
          award_winner: boolean;
          citation_count: number;
          citation_formats: Json | null;
          citation_generated_at: string | null;
          citation_source_hash: string | null;
          doi: string | null;
          featured: boolean;
          file_name: string;
          file_path: string;
          grade: string | null;
          id: string;
          issue: string | null;
          keywords: string[] | null;
          mime_type: string;
          nyrj_id: string | null;
          orcids: string[] | null;
          publication_date: string | null;
          references_text: string | null;
          slug: string | null;
          title: string;
          topic: string | null;
        };
        Insert: {
          abstract?: string | null;
          added_at?: string;
          author_email?: string | null;
          authors: string;
          award_label?: string | null;
          award_winner?: boolean;
          citation_count?: number;
          citation_formats?: Json | null;
          citation_generated_at?: string | null;
          citation_source_hash?: string | null;
          doi?: string | null;
          featured?: boolean;
          file_name: string;
          file_path: string;
          grade?: string | null;
          id?: string;
          issue?: string | null;
          keywords?: string[] | null;
          mime_type: string;
          nyrj_id?: string | null;
          orcids?: string[] | null;
          publication_date?: string | null;
          references_text?: string | null;
          slug?: string | null;
          title: string;
          topic?: string | null;
        };
        Update: {
          abstract?: string | null;
          added_at?: string;
          author_email?: string | null;
          authors?: string;
          award_label?: string | null;
          award_winner?: boolean;
          citation_count?: number;
          citation_formats?: Json | null;
          citation_generated_at?: string | null;
          citation_source_hash?: string | null;
          doi?: string | null;
          featured?: boolean;
          file_name?: string;
          file_path?: string;
          grade?: string | null;
          id?: string;
          issue?: string | null;
          keywords?: string[] | null;
          mime_type?: string;
          nyrj_id?: string | null;
          orcids?: string[] | null;
          publication_date?: string | null;
          references_text?: string | null;
          slug?: string | null;
          title?: string;
          topic?: string | null;
        };
        Relationships: [];
      };
      manuscript_submissions: {
        Row: {
          abstract: string | null;
          all_authors_consent: boolean | null;
          authors: Json;
          comments: string | null;
          conflict_explanation: string | null;
          conflict_of_interest: boolean;
          consent_form_paths: Json;
          created_at: string;
          current_version: number;
          data_availability: string | null;
          decision: string;
          deleted_at: string | null;
          funding: boolean;
          funding_source: string | null;
          gen_ai_explanation: string | null;
          has_human_or_vertebrate: boolean | null;
          id: string;
          initial_reviewer_assigned_at: string | null;
          initial_reviewer_email: string;
          initial_reviewer_name: string;
          is_original: boolean | null;
          keywords: string;
          manuscript_filename: string | null;
          manuscript_path: string | null;
          not_under_consideration: boolean | null;
          referral_code: string;
          research_domain: string;
          research_type: string | null;
          research_type_other: string | null;
          resubmit_token: string | null;
          status: string;
          submitter_email: string;
          supplementary_paths: Json;
          title: string;
          updated_at: string;
          used_gen_ai: boolean;
        };
        Insert: {
          abstract?: string | null;
          all_authors_consent?: boolean | null;
          authors?: Json;
          comments?: string | null;
          conflict_explanation?: string | null;
          conflict_of_interest?: boolean;
          consent_form_paths?: Json;
          created_at?: string;
          current_version?: number;
          data_availability?: string | null;
          decision?: string;
          deleted_at?: string | null;
          funding?: boolean;
          funding_source?: string | null;
          gen_ai_explanation?: string | null;
          has_human_or_vertebrate?: boolean | null;
          id?: string;
          initial_reviewer_assigned_at?: string | null;
          initial_reviewer_email?: string;
          initial_reviewer_name?: string;
          is_original?: boolean | null;
          keywords?: string;
          manuscript_filename?: string | null;
          manuscript_path?: string | null;
          not_under_consideration?: boolean | null;
          referral_code?: string;
          research_domain?: string;
          research_type?: string | null;
          research_type_other?: string | null;
          resubmit_token?: string | null;
          status?: string;
          submitter_email: string;
          supplementary_paths?: Json;
          title: string;
          updated_at?: string;
          used_gen_ai?: boolean;
        };
        Update: {
          abstract?: string | null;
          all_authors_consent?: boolean | null;
          authors?: Json;
          comments?: string | null;
          conflict_explanation?: string | null;
          conflict_of_interest?: boolean;
          consent_form_paths?: Json;
          created_at?: string;
          current_version?: number;
          data_availability?: string | null;
          decision?: string;
          deleted_at?: string | null;
          funding?: boolean;
          funding_source?: string | null;
          gen_ai_explanation?: string | null;
          has_human_or_vertebrate?: boolean | null;
          id?: string;
          initial_reviewer_assigned_at?: string | null;
          initial_reviewer_email?: string;
          initial_reviewer_name?: string;
          is_original?: boolean | null;
          keywords?: string;
          manuscript_filename?: string | null;
          manuscript_path?: string | null;
          not_under_consideration?: boolean | null;
          referral_code?: string;
          research_domain?: string;
          research_type?: string | null;
          research_type_other?: string | null;
          resubmit_token?: string | null;
          status?: string;
          submitter_email?: string;
          supplementary_paths?: Json;
          title?: string;
          updated_at?: string;
          used_gen_ai?: boolean;
        };
        Relationships: [];
      };
      manuscript_versions: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          manuscript_filename: string;
          manuscript_path: string;
          note: string;
          submission_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label?: string;
          manuscript_filename?: string;
          manuscript_path?: string;
          note?: string;
          submission_id: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          manuscript_filename?: string;
          manuscript_path?: string;
          note?: string;
          submission_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "manuscript_versions_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "manuscript_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      peer_reviewers: {
        Row: {
          approved_at: string | null;
          created_at: string;
          email: string;
          expertise: string;
          id: string;
          name: string;
          password_hash: string;
          password_salt: string;
          status: string;
          username: string;
        };
        Insert: {
          approved_at?: string | null;
          created_at?: string;
          email: string;
          expertise?: string;
          id?: string;
          name: string;
          password_hash: string;
          password_salt: string;
          status?: string;
          username: string;
        };
        Update: {
          approved_at?: string | null;
          created_at?: string;
          email?: string;
          expertise?: string;
          id?: string;
          name?: string;
          password_hash?: string;
          password_salt?: string;
          status?: string;
          username?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          age: number | null;
          created_at: string;
          email: string;
          full_name: string | null;
          grade: string | null;
          id: string;
          phone: string | null;
          school: string | null;
          updated_at: string;
        };
        Insert: {
          age?: number | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          grade?: string | null;
          id: string;
          phone?: string | null;
          school?: string | null;
          updated_at?: string;
        };
        Update: {
          age?: number | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          grade?: string | null;
          id?: string;
          phone?: string | null;
          school?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      review_assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string;
          due_at: string;
          edits_sent_at: string | null;
          edits_sent_body: string;
          id: string;
          invite_reminder_sent_at: string | null;
          invite_token: string;
          no_response_notified_at: string | null;
          responded_at: string | null;
          review_comments: string;
          review_reminder_sent_at: string | null;
          review_submitted_at: string | null;
          reviewer_email: string;
          reviewer_name: string;
          status: string;
          submission_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string;
          due_at?: string;
          edits_sent_at?: string | null;
          edits_sent_body?: string;
          id?: string;
          invite_reminder_sent_at?: string | null;
          invite_token: string;
          no_response_notified_at?: string | null;
          responded_at?: string | null;
          review_comments?: string;
          review_reminder_sent_at?: string | null;
          review_submitted_at?: string | null;
          reviewer_email: string;
          reviewer_name?: string;
          status?: string;
          submission_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string;
          due_at?: string;
          edits_sent_at?: string | null;
          edits_sent_body?: string;
          id?: string;
          invite_reminder_sent_at?: string | null;
          invite_token?: string;
          no_response_notified_at?: string | null;
          responded_at?: string | null;
          review_comments?: string;
          review_reminder_sent_at?: string | null;
          review_submitted_at?: string | null;
          reviewer_email?: string;
          reviewer_name?: string;
          status?: string;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_assignments_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "manuscript_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      review_audit_log: {
        Row: {
          action: string;
          actor: string;
          created_at: string;
          detail: string;
          id: string;
          submission_id: string | null;
        };
        Insert: {
          action: string;
          actor?: string;
          created_at?: string;
          detail?: string;
          id?: string;
          submission_id?: string | null;
        };
        Update: {
          action?: string;
          actor?: string;
          created_at?: string;
          detail?: string;
          id?: string;
          submission_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "review_audit_log_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "manuscript_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      sent_emails: {
        Row: {
          created_at: string;
          error: string | null;
          html: string | null;
          id: string;
          reply_to: string | null;
          status: string;
          subject: string;
          template: string;
          text_body: string | null;
          to_email: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          html?: string | null;
          id?: string;
          reply_to?: string | null;
          status?: string;
          subject: string;
          template: string;
          text_body?: string | null;
          to_email: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          html?: string | null;
          id?: string;
          reply_to?: string | null;
          status?: string;
          subject?: string;
          template?: string;
          text_body?: string | null;
          to_email?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      sponsors: {
        Row: {
          blurb: string | null;
          created_at: string;
          id: string;
          logo_path: string | null;
          name: string;
          position: number;
          tier: string;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          blurb?: string | null;
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          name: string;
          position?: number;
          tier?: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          blurb?: string | null;
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          name?: string;
          position?: number;
          tier?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      submissions: {
        Row: {
          created_at: string;
          decision: Database["public"]["Enums"]["submission_decision"];
          id: string;
          manuscript_name: string;
          status: Database["public"]["Enums"]["submission_status"];
          student_email: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          decision?: Database["public"]["Enums"]["submission_decision"];
          id?: string;
          manuscript_name: string;
          status?: Database["public"]["Enums"]["submission_status"];
          student_email: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          decision?: Database["public"]["Enums"]["submission_decision"];
          id?: string;
          manuscript_name?: string;
          status?: Database["public"]["Enums"]["submission_status"];
          student_email?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          bio: string | null;
          created_at: string;
          id: string;
          name: string;
          photo_path: string | null;
          role: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          photo_path?: string | null;
          role: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          photo_path?: string | null;
          role?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      consume_ai_chat_quota: {
        Args: { p_identity_hash: string };
        Returns: {
          allowed: boolean;
          remaining: number;
          retry_after_seconds: number;
        }[];
      };
      consume_api_rate_limit: {
        Args: {
          p_identity_hash: string;
          p_limit: number;
          p_scope: string;
          p_window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          remaining: number;
          retry_after_seconds: number;
        }[];
      };
      increment_citation_count: { Args: { _id: string }; Returns: number };
      slugify: { Args: { _input: string }; Returns: string };
    };
    Enums: {
      submission_decision: "pending" | "accepted" | "declined";
      submission_status:
        | "initial review"
        | "editorial review"
        | "waiting for edits"
        | "secondary review"
        | "publishing"
        | "published";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      submission_decision: ["pending", "accepted", "declined"],
      submission_status: [
        "initial review",
        "editorial review",
        "waiting for edits",
        "secondary review",
        "publishing",
        "published",
      ],
    },
  },
} as const;
