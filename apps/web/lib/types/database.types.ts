// Tipos da base de dados Neuma.
// Escritos a mao a partir de supabase/migrations/*.sql.

export type UserRole = "mentor" | "student";
export type ProfileGender = "female" | "male" | "other";
export type NodeStatus = "locked" | "active" | "completed";
export type CheckInStatus = "pending" | "approved" | "needs_revision";
export type PathStatus = "draft" | "active" | "completed" | "paused";
export type NodeKind = "practice" | "call" | "milestone" | "lesson" | "resource";
export type CheckInKind = "video" | "text" | "call";
export type FormQuestionType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multi_choice"
  | "scale";
export type FeedbackDraftStatus = "pending_review" | "published" | "rejected";
export type StudentFeedbackViewKind = "check_in" | "level";
export type TallySubmissionKind = "onboarding" | "checkin" | "unknown";
export type TallySubmissionStatus =
  | "pending"
  | "linked"
  | "processed"
  | "failed"
  | "archived";
export type CalBookingStatus =
  | "accepted"
  | "cancelled"
  | "rescheduled"
  | "pending"
  | "rejected";
export type MentorCalendarEventKind =
  | "reminder"
  | "meeting"
  | "event"
  | "misc";
export type LibraryAssetKind = "video" | "text" | "image" | "file" | "link";
export type LibraryAssetUsage = "practice" | "lesson";
export type PathTemplateStatus = "draft" | "ready" | "archived";
export type BillingPlan = "monthly" | "quarterly" | "annual" | "one_to_one";
export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";
export type OneToOneInviteStatus =
  | "pending"
  | "sent"
  | "paid"
  | "expired"
  | "revoked";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          bio: string | null;
          instagram: string | null;
          whatsapp: string | null;
          age: number | null;
          gender: ProfileGender | null;
          onboarding_completed: boolean;
          can_book_sessions: boolean;
          cal_username: string | null;
          mentor_style_notes: string | null;
          internal_notes: string | null;
          mentor_id: string | null;
          billing_exempt: boolean;
          is_one_to_one: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          instagram?: string | null;
          whatsapp?: string | null;
          age?: number | null;
          gender?: ProfileGender | null;
          onboarding_completed?: boolean;
          can_book_sessions?: boolean;
          cal_username?: string | null;
          mentor_style_notes?: string | null;
          internal_notes?: string | null;
          mentor_id?: string | null;
          billing_exempt?: boolean;
          is_one_to_one?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          instagram?: string | null;
          whatsapp?: string | null;
          age?: number | null;
          gender?: ProfileGender | null;
          onboarding_completed?: boolean;
          can_book_sessions?: boolean;
          cal_username?: string | null;
          mentor_style_notes?: string | null;
          internal_notes?: string | null;
          mentor_id?: string | null;
          billing_exempt?: boolean;
          is_one_to_one?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_mentor_id_fkey";
            columns: ["mentor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      paths: {
        Row: {
          id: string;
          student_id: string | null;
          placeholder_name: string | null;
          claim_email: string | null;
          claimed_at: string | null;
          created_by: string | null;
          title: string;
          description: string | null;
          goal: string | null;
          start_date: string | null;
          end_date: string | null;
          duration_label: string | null;
          status: PathStatus;
          source_template_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id?: string | null;
          placeholder_name?: string | null;
          claim_email?: string | null;
          claimed_at?: string | null;
          created_by?: string | null;
          title: string;
          description?: string | null;
          goal?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          duration_label?: string | null;
          status?: PathStatus;
          source_template_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string | null;
          placeholder_name?: string | null;
          claim_email?: string | null;
          claimed_at?: string | null;
          created_by?: string | null;
          title?: string;
          description?: string | null;
          goal?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          duration_label?: string | null;
          status?: PathStatus;
          source_template_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paths_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paths_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paths_source_template_id_fkey";
            columns: ["source_template_id"];
            isOneToOne: false;
            referencedRelation: "path_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      nodes: {
        Row: {
          id: string;
          path_id: string;
          title: string;
          description: string | null;
          order_index: number;
          status: NodeStatus;
          week_number: number | null;
          kind: NodeKind;
          due_date: string | null;
          resource_url: string | null;
          content_body: string | null;
          week_extensions: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          path_id: string;
          title: string;
          description?: string | null;
          order_index: number;
          status?: NodeStatus;
          week_number?: number | null;
          kind?: NodeKind;
          due_date?: string | null;
          content_body?: string | null;
          resource_url?: string | null;
          week_extensions?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          path_id?: string;
          title?: string;
          description?: string | null;
          order_index?: number;
          status?: NodeStatus;
          week_number?: number | null;
          kind?: NodeKind;
          due_date?: string | null;
          resource_url?: string | null;
          content_body?: string | null;
          week_extensions?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nodes_path_id_fkey";
            columns: ["path_id"];
            isOneToOne: false;
            referencedRelation: "paths";
            referencedColumns: ["id"];
          },
        ];
      };
      check_ins: {
        Row: {
          id: string;
          node_id: string | null;
          student_id: string;
          video_url: string | null;
          notes: string | null;
          ai_summary: string | null;
          status: CheckInStatus;
          kind: CheckInKind;
          level_label: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          node_id?: string | null;
          student_id: string;
          video_url?: string | null;
          notes?: string | null;
          ai_summary?: string | null;
          status?: CheckInStatus;
          kind?: CheckInKind;
          level_label?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          node_id?: string | null;
          student_id?: string;
          video_url?: string | null;
          notes?: string | null;
          ai_summary?: string | null;
          status?: CheckInStatus;
          kind?: CheckInKind;
          level_label?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "check_ins_node_id_fkey";
            columns: ["node_id"];
            isOneToOne: false;
            referencedRelation: "nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "check_ins_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      feedbacks: {
        Row: {
          id: string;
          check_in_id: string;
          mentor_id: string;
          video_url: string | null;
          notes: string | null;
          next_steps: string | null;
          approved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          check_in_id: string;
          mentor_id: string;
          video_url?: string | null;
          notes?: string | null;
          next_steps?: string | null;
          approved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          check_in_id?: string;
          mentor_id?: string;
          video_url?: string | null;
          notes?: string | null;
          next_steps?: string | null;
          approved?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedbacks_check_in_id_fkey";
            columns: ["check_in_id"];
            isOneToOne: true;
            referencedRelation: "check_ins";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedbacks_mentor_id_fkey";
            columns: ["mentor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      level_feedbacks: {
        Row: {
          id: string;
          node_id: string;
          mentor_id: string;
          notes: string | null;
          video_url: string | null;
          file_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          node_id: string;
          mentor_id: string;
          notes?: string | null;
          video_url?: string | null;
          file_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          node_id?: string;
          mentor_id?: string;
          notes?: string | null;
          video_url?: string | null;
          file_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "level_feedbacks_node_id_fkey";
            columns: ["node_id"];
            isOneToOne: false;
            referencedRelation: "nodes";
            referencedColumns: ["id"];
          },
        ];
      };
      student_feedback_views: {
        Row: {
          id: string;
          student_id: string;
          feedback_kind: StudentFeedbackViewKind;
          reference_id: string;
          viewed_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          feedback_kind: StudentFeedbackViewKind;
          reference_id: string;
          viewed_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          feedback_kind?: StudentFeedbackViewKind;
          reference_id?: string;
          viewed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_feedback_views_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      diagnostics: {
        Row: {
          id: string;
          student_id: string;
          responses: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          responses: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          responses?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "diagnostics_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      forms: {
        Row: {
          id: string;
          created_by: string | null;
          title: string;
          description: string | null;
          is_active: boolean;
          is_onboarding: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          created_by?: string | null;
          title: string;
          description?: string | null;
          is_active?: boolean;
          is_onboarding?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          created_by?: string | null;
          title?: string;
          description?: string | null;
          is_active?: boolean;
          is_onboarding?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "forms_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      form_questions: {
        Row: {
          id: string;
          form_id: string;
          order_index: number;
          label: string;
          help_text: string | null;
          type: FormQuestionType;
          options: Json | null;
          required: boolean;
        };
        Insert: {
          id?: string;
          form_id: string;
          order_index: number;
          label: string;
          help_text?: string | null;
          type?: FormQuestionType;
          options?: Json | null;
          required?: boolean;
        };
        Update: {
          id?: string;
          form_id?: string;
          order_index?: number;
          label?: string;
          help_text?: string | null;
          type?: FormQuestionType;
          options?: Json | null;
          required?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "form_questions_form_id_fkey";
            columns: ["form_id"];
            isOneToOne: false;
            referencedRelation: "forms";
            referencedColumns: ["id"];
          },
        ];
      };
      form_responses: {
        Row: {
          id: string;
          form_id: string;
          student_id: string;
          answers: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          form_id: string;
          student_id: string;
          answers: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          form_id?: string;
          student_id?: string;
          answers?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "form_responses_form_id_fkey";
            columns: ["form_id"];
            isOneToOne: false;
            referencedRelation: "forms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "form_responses_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback_drafts: {
        Row: {
          id: string;
          check_in_id: string;
          mentor_id: string | null;
          status: FeedbackDraftStatus;
          body_notes: string | null;
          body_next_steps: string | null;
          model: string | null;
          prompt_version: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          check_in_id: string;
          mentor_id?: string | null;
          status?: FeedbackDraftStatus;
          body_notes?: string | null;
          body_next_steps?: string | null;
          model?: string | null;
          prompt_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          check_in_id?: string;
          mentor_id?: string | null;
          status?: FeedbackDraftStatus;
          body_notes?: string | null;
          body_next_steps?: string | null;
          model?: string | null;
          prompt_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_drafts_check_in_id_fkey";
            columns: ["check_in_id"];
            isOneToOne: true;
            referencedRelation: "check_ins";
            referencedColumns: ["id"];
          },
        ];
      };
      tally_submissions: {
        Row: {
          id: string;
          source: string;
          source_event_id: string | null;
          source_response_id: string | null;
          source_submission_id: string | null;
          source_form_id: string;
          source_form_name: string | null;
          submission_kind: TallySubmissionKind;
          status: TallySubmissionStatus;
          respondent_name: string | null;
          respondent_email: string | null;
          student_id: string | null;
          node_id: string | null;
          check_in_id: string | null;
          notes: string | null;
          video_url: string | null;
          answers: Json;
          payload: Json;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          source?: string;
          source_event_id?: string | null;
          source_response_id?: string | null;
          source_submission_id?: string | null;
          source_form_id: string;
          source_form_name?: string | null;
          submission_kind?: TallySubmissionKind;
          status?: TallySubmissionStatus;
          respondent_name?: string | null;
          respondent_email?: string | null;
          student_id?: string | null;
          node_id?: string | null;
          check_in_id?: string | null;
          notes?: string | null;
          video_url?: string | null;
          answers?: Json;
          payload: Json;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          source?: string;
          source_event_id?: string | null;
          source_response_id?: string | null;
          source_submission_id?: string | null;
          source_form_id?: string;
          source_form_name?: string | null;
          submission_kind?: TallySubmissionKind;
          status?: TallySubmissionStatus;
          respondent_name?: string | null;
          respondent_email?: string | null;
          student_id?: string | null;
          node_id?: string | null;
          check_in_id?: string | null;
          notes?: string | null;
          video_url?: string | null;
          answers?: Json;
          payload?: Json;
          created_at?: string;
          processed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tally_submissions_check_in_id_fkey";
            columns: ["check_in_id"];
            isOneToOne: false;
            referencedRelation: "check_ins";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tally_submissions_node_id_fkey";
            columns: ["node_id"];
            isOneToOne: false;
            referencedRelation: "nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tally_submissions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cal_bookings: {
        Row: {
          id: string;
          cal_booking_uid: string;
          cal_booking_id: number | null;
          trigger_event: string;
          status: CalBookingStatus;
          title: string | null;
          event_type_slug: string | null;
          start_time: string;
          end_time: string;
          timezone: string | null;
          meet_url: string | null;
          organizer_email: string | null;
          organizer_name: string | null;
          attendee_email: string | null;
          attendee_name: string | null;
          student_id: string | null;
          notes: string | null;
          payload: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cal_booking_uid: string;
          cal_booking_id?: number | null;
          trigger_event: string;
          status?: CalBookingStatus;
          title?: string | null;
          event_type_slug?: string | null;
          start_time: string;
          end_time: string;
          timezone?: string | null;
          meet_url?: string | null;
          organizer_email?: string | null;
          organizer_name?: string | null;
          attendee_email?: string | null;
          attendee_name?: string | null;
          student_id?: string | null;
          notes?: string | null;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cal_booking_uid?: string;
          cal_booking_id?: number | null;
          trigger_event?: string;
          status?: CalBookingStatus;
          title?: string | null;
          event_type_slug?: string | null;
          start_time?: string;
          end_time?: string;
          timezone?: string | null;
          meet_url?: string | null;
          organizer_email?: string | null;
          organizer_name?: string | null;
          attendee_email?: string | null;
          attendee_name?: string | null;
          student_id?: string | null;
          notes?: string | null;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cal_bookings_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      mentor_calendar_events: {
        Row: {
          id: string;
          mentor_id: string;
          title: string;
          kind: MentorCalendarEventKind;
          starts_at: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
          student_id: string | null;
          path_id: string | null;
          node_id: string | null;
          ends_at: string | null;
          source: "manual" | "agent";
        };
        Insert: {
          id?: string;
          mentor_id: string;
          title: string;
          kind: MentorCalendarEventKind;
          starts_at: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          student_id?: string | null;
          path_id?: string | null;
          node_id?: string | null;
          ends_at?: string | null;
          source?: "manual" | "agent";
        };
        Update: {
          id?: string;
          mentor_id?: string;
          title?: string;
          kind?: MentorCalendarEventKind;
          starts_at?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          student_id?: string | null;
          path_id?: string | null;
          node_id?: string | null;
          ends_at?: string | null;
          source?: "manual" | "agent";
        };
        Relationships: [
          {
            foreignKeyName: "mentor_calendar_events_mentor_id_fkey";
            columns: ["mentor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chord_voicing_overrides: {
        Row: {
          id: string;
          instrument: "piano" | "guitar";
          chord_key: string;
          voicing_id: string;
          payload: Json;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instrument: "piano" | "guitar";
          chord_key: string;
          voicing_id?: string;
          payload: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          instrument?: "piano" | "guitar";
          chord_key?: string;
          voicing_id?: string;
          payload?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chord_voicing_overrides_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      library_assets: {
        Row: {
          id: string;
          title: string;
          summary: string | null;
          kind: LibraryAssetKind;
          usage: LibraryAssetUsage;
          topic_id: string | null;
          body: string | null;
          url: string | null;
          storage_path: string | null;
          tags: string[];
          cover_url: string | null;
          duration_label: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
          content_status: "empty" | "drafting" | "ready";
          created_by_agent: boolean;
        };
        Insert: {
          id?: string;
          title: string;
          summary?: string | null;
          kind?: LibraryAssetKind;
          usage?: LibraryAssetUsage;
          topic_id?: string | null;
          body?: string | null;
          url?: string | null;
          storage_path?: string | null;
          tags?: string[];
          cover_url?: string | null;
          duration_label?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
          content_status?: "empty" | "drafting" | "ready";
          created_by_agent?: boolean;
        };
        Update: {
          id?: string;
          title?: string;
          summary?: string | null;
          kind?: LibraryAssetKind;
          usage?: LibraryAssetUsage;
          topic_id?: string | null;
          body?: string | null;
          url?: string | null;
          storage_path?: string | null;
          tags?: string[];
          cover_url?: string | null;
          duration_label?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
          content_status?: "empty" | "drafting" | "ready";
          created_by_agent?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "library_assets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "library_assets_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "library_topics";
            referencedColumns: ["id"];
          },
        ];
      };
      library_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          sort_index: number;
          theme: "acoustic" | "electric" | "piano" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          sort_index?: number;
          theme?: "acoustic" | "electric" | "piano" | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          sort_index?: number;
          theme?: "acoustic" | "electric" | "piano" | null;
          created_at?: string;
        };
        Relationships: [];
      };
      library_topics: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          slug: string;
          sort_index: number;
          created_at: string;
          created_by_agent: boolean;
          rationale: string | null;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          slug: string;
          sort_index?: number;
          created_at?: string;
          created_by_agent?: boolean;
          rationale?: string | null;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          slug?: string;
          sort_index?: number;
          created_at?: string;
          created_by_agent?: boolean;
          rationale?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "library_topics_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "library_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      path_templates: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          goal: string | null;
          duration_label: string | null;
          suggested_node_count: number | null;
          status: PathTemplateStatus;
          start_date: string | null;
          end_date: string | null;
          period_months: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          goal?: string | null;
          duration_label?: string | null;
          suggested_node_count?: number | null;
          status?: PathTemplateStatus;
          start_date?: string | null;
          end_date?: string | null;
          period_months?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          goal?: string | null;
          duration_label?: string | null;
          suggested_node_count?: number | null;
          status?: PathTemplateStatus;
          start_date?: string | null;
          end_date?: string | null;
          period_months?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "path_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      path_template_nodes: {
        Row: {
          id: string;
          template_id: string;
          order_index: number;
          title: string;
          description: string | null;
          kind: NodeKind;
          week_number: number | null;
          duration_weeks: number | null;
          default_resource_url: string | null;
          library_asset_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          order_index: number;
          title: string;
          description?: string | null;
          kind?: NodeKind;
          week_number?: number | null;
          duration_weeks?: number | null;
          default_resource_url?: string | null;
          library_asset_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          order_index?: number;
          title?: string;
          description?: string | null;
          kind?: NodeKind;
          week_number?: number | null;
          duration_weeks?: number | null;
          default_resource_url?: string | null;
          library_asset_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "path_template_nodes_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "path_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "path_template_nodes_library_asset_id_fkey";
            columns: ["library_asset_id"];
            isOneToOne: false;
            referencedRelation: "library_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      node_quiz_questions: {
        Row: {
          id: string;
          node_id: string;
          order_index: number;
          prompt: string;
          options: Json;
          correct_option_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          node_id: string;
          order_index?: number;
          prompt: string;
          options?: Json;
          correct_option_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          node_id?: string;
          order_index?: number;
          prompt?: string;
          options?: Json;
          correct_option_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "node_quiz_questions_node_id_fkey";
            columns: ["node_id"];
            isOneToOne: false;
            referencedRelation: "nodes";
            referencedColumns: ["id"];
          },
        ];
      };
      node_quiz_attempts: {
        Row: {
          id: string;
          node_id: string;
          student_id: string;
          answers: Json;
          score: number;
          correct_count: number;
          total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          node_id: string;
          student_id: string;
          answers?: Json;
          score: number;
          correct_count: number;
          total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          node_id?: string;
          student_id?: string;
          answers?: Json;
          score?: number;
          correct_count?: number;
          total?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "node_quiz_attempts_node_id_fkey";
            columns: ["node_id"];
            isOneToOne: false;
            referencedRelation: "nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "node_quiz_attempts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      student_reviews: {
        Row: {
          id: string;
          student_id: string;
          topic: string;
          rating: number | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          topic?: string;
          rating?: number | null;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          topic?: string;
          rating?: number | null;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_reviews_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      student_briefs: {
        Row: {
          id: string;
          student_id: string | null;
          path_id: string | null;
          placeholder_name: string | null;
          raw_markdown: string;
          structured: Json;
          source: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id?: string | null;
          path_id?: string | null;
          placeholder_name?: string | null;
          raw_markdown: string;
          structured?: Json;
          source?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string | null;
          path_id?: string | null;
          placeholder_name?: string | null;
          raw_markdown?: string;
          structured?: Json;
          source?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_threads: {
        Row: {
          id: string;
          mentor_id: string;
          title: string | null;
          pattern: string;
          last_message_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          mentor_id: string;
          title?: string | null;
          pattern?: string;
          last_message_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          mentor_id?: string;
          title?: string | null;
          pattern?: string;
          last_message_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      agent_runs: {
        Row: {
          id: string;
          thread_id: string | null;
          mentor_id: string;
          pattern: string;
          model: string | null;
          status: string;
          latency_ms: number | null;
          error: string | null;
          token_usage: Json;
          events: Json;
          created_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          thread_id?: string | null;
          mentor_id: string;
          pattern?: string;
          model?: string | null;
          status?: string;
          latency_ms?: number | null;
          error?: string | null;
          token_usage?: Json;
          events?: Json;
          created_at?: string;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          thread_id?: string | null;
          mentor_id?: string;
          pattern?: string;
          model?: string | null;
          status?: string;
          latency_ms?: number | null;
          error?: string | null;
          token_usage?: Json;
          events?: Json;
          created_at?: string;
          finished_at?: string | null;
        };
        Relationships: [];
      };
      agent_proposals: {
        Row: {
          id: string;
          kind: string;
          status: string;
          title: string;
          summary: string | null;
          payload: Json;
          target_table: string | null;
          target_id: string | null;
          thread_id: string | null;
          run_id: string | null;
          mentor_id: string;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          applied_at: string | null;
        };
        Insert: {
          id?: string;
          kind: string;
          status?: string;
          title: string;
          summary?: string | null;
          payload?: Json;
          target_table?: string | null;
          target_id?: string | null;
          thread_id?: string | null;
          run_id?: string | null;
          mentor_id: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          applied_at?: string | null;
        };
        Update: {
          id?: string;
          kind?: string;
          status?: string;
          title?: string;
          summary?: string | null;
          payload?: Json;
          target_table?: string | null;
          target_id?: string | null;
          thread_id?: string | null;
          run_id?: string | null;
          mentor_id?: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          applied_at?: string | null;
        };
        Relationships: [];
      };
      agent_memories: {
        Row: {
          id: string;
          mentor_id: string;
          scope: string;
          key: string;
          value: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mentor_id: string;
          scope?: string;
          key: string;
          value: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          mentor_id?: string;
          scope?: string;
          key?: string;
          value?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      finance_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      billing_customers: {
        Row: {
          profile_id: string;
          stripe_customer_id: string;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          stripe_customer_id: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          stripe_customer_id?: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          profile_id: string | null;
          student_name: string | null;
          student_email: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string;
          stripe_price_id: string | null;
          stripe_item_id: string | null;
          plan: BillingPlan | null;
          status: SubscriptionStatus;
          currency: string;
          unit_amount: number | null;
          interval: string | null;
          interval_count: number;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          ended_at: string | null;
          trial_end: string | null;
          collection_paused: boolean;
          paused_at: string | null;
          past_due_since: string | null;
          card_brand: string | null;
          card_last4: string | null;
          latest_invoice_id: string | null;
          stripe_event_at: string | null;
          raw: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          student_name?: string | null;
          student_email?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id: string;
          stripe_price_id?: string | null;
          stripe_item_id?: string | null;
          plan?: BillingPlan | null;
          status: SubscriptionStatus;
          currency?: string;
          unit_amount?: number | null;
          interval?: string | null;
          interval_count?: number;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          ended_at?: string | null;
          trial_end?: string | null;
          collection_paused?: boolean;
          paused_at?: string | null;
          past_due_since?: string | null;
          card_brand?: string | null;
          card_last4?: string | null;
          latest_invoice_id?: string | null;
          stripe_event_at?: string | null;
          raw?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          student_name?: string | null;
          student_email?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string;
          stripe_price_id?: string | null;
          stripe_item_id?: string | null;
          plan?: BillingPlan | null;
          status?: SubscriptionStatus;
          currency?: string;
          unit_amount?: number | null;
          interval?: string | null;
          interval_count?: number;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          ended_at?: string | null;
          trial_end?: string | null;
          collection_paused?: boolean;
          paused_at?: string | null;
          past_due_since?: string | null;
          card_brand?: string | null;
          card_last4?: string | null;
          latest_invoice_id?: string | null;
          stripe_event_at?: string | null;
          raw?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          profile_id: string | null;
          subscription_id: string | null;
          student_name: string | null;
          student_email: string | null;
          stripe_invoice_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_charge_id: string | null;
          stripe_customer_id: string | null;
          plan: BillingPlan | null;
          amount_cents: number;
          amount_refunded_cents: number;
          currency: string;
          status: string | null;
          description: string | null;
          hosted_invoice_url: string | null;
          invoice_pdf: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          subscription_id?: string | null;
          student_name?: string | null;
          student_email?: string | null;
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          stripe_customer_id?: string | null;
          plan?: BillingPlan | null;
          amount_cents?: number;
          amount_refunded_cents?: number;
          currency?: string;
          status?: string | null;
          description?: string | null;
          hosted_invoice_url?: string | null;
          invoice_pdf?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          subscription_id?: string | null;
          student_name?: string | null;
          student_email?: string | null;
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          stripe_customer_id?: string | null;
          plan?: BillingPlan | null;
          amount_cents?: number;
          amount_refunded_cents?: number;
          currency?: string;
          status?: string | null;
          description?: string | null;
          hosted_invoice_url?: string | null;
          invoice_pdf?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      refunds: {
        Row: {
          id: string;
          payment_id: string | null;
          profile_id: string | null;
          stripe_refund_id: string;
          amount_cents: number;
          currency: string;
          reason: string | null;
          created_by: string | null;
          refunded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id?: string | null;
          profile_id?: string | null;
          stripe_refund_id: string;
          amount_cents: number;
          currency?: string;
          reason?: string | null;
          created_by?: string | null;
          refunded_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string | null;
          profile_id?: string | null;
          stripe_refund_id?: string;
          amount_cents?: number;
          currency?: string;
          reason?: string | null;
          created_by?: string | null;
          refunded_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      subscription_events: {
        Row: {
          id: string;
          subscription_id: string | null;
          profile_id: string | null;
          actor_id: string | null;
          action: string;
          detail: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id?: string | null;
          profile_id?: string | null;
          actor_id?: string | null;
          action: string;
          detail?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          subscription_id?: string | null;
          profile_id?: string | null;
          actor_id?: string | null;
          action?: string;
          detail?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      stripe_events: {
        Row: {
          id: string;
          type: string;
          api_version: string | null;
          payload: Json | null;
          received_at: string;
          processed_at: string | null;
          error: string | null;
        };
        Insert: {
          id: string;
          type: string;
          api_version?: string | null;
          payload?: Json | null;
          received_at?: string;
          processed_at?: string | null;
          error?: string | null;
        };
        Update: {
          id?: string;
          type?: string;
          api_version?: string | null;
          payload?: Json | null;
          received_at?: string;
          processed_at?: string | null;
          error?: string | null;
        };
        Relationships: [];
      };
      one_to_one_invites: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          token_hash: string;
          amount_cents: number;
          currency: string;
          interval: string;
          interval_count: number;
          stripe_price_id: string | null;
          stripe_checkout_session_id: string | null;
          status: OneToOneInviteStatus;
          notes: string | null;
          source_submission_id: string | null;
          created_by: string | null;
          expires_at: string | null;
          redeemed_profile_id: string | null;
          redeemed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          token_hash: string;
          amount_cents: number;
          currency?: string;
          interval?: string;
          interval_count?: number;
          stripe_price_id?: string | null;
          stripe_checkout_session_id?: string | null;
          status?: OneToOneInviteStatus;
          notes?: string | null;
          source_submission_id?: string | null;
          created_by?: string | null;
          expires_at?: string | null;
          redeemed_profile_id?: string | null;
          redeemed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          token_hash?: string;
          amount_cents?: number;
          currency?: string;
          interval?: string;
          interval_count?: number;
          stripe_price_id?: string | null;
          stripe_checkout_session_id?: string | null;
          status?: OneToOneInviteStatus;
          notes?: string | null;
          source_submission_id?: string | null;
          created_by?: string | null;
          expires_at?: string | null;
          redeemed_profile_id?: string | null;
          redeemed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_mentor: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      mentor_dashboard_facts: {
        Args: Record<string, never>;
        Returns: Json;
      };
      has_app_access: {
        Args: { uid: string };
        Returns: boolean;
      };
      finance_dashboard: {
        Args: {
          p_from: string;
          p_to: string;
          p_bucket?: string;
          p_tz?: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      user_role: UserRole;
      node_status: NodeStatus;
      check_in_status: CheckInStatus;
      path_status: PathStatus;
      node_kind: NodeKind;
      check_in_kind: CheckInKind;
      form_question_type: FormQuestionType;
      feedback_draft_status: FeedbackDraftStatus;
      library_asset_kind: LibraryAssetKind;
      library_asset_usage: LibraryAssetUsage;
      path_template_status: PathTemplateStatus;
      billing_plan: BillingPlan;
      subscription_status: SubscriptionStatus;
      one_to_one_invite_status: OneToOneInviteStatus;
    };
  };
}
