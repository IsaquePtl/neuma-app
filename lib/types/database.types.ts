// Tipos da base de dados Neuma.
// Escritos a mao a partir de supabase/migrations/*.sql.

export type UserRole = "mentor" | "student";
export type NodeStatus = "locked" | "active" | "completed";
export type CheckInStatus = "pending" | "approved" | "needs_revision";
export type PathStatus = "draft" | "active" | "completed" | "paused";
export type NodeKind = "practice" | "call" | "milestone" | "resource";
export type CheckInKind = "video" | "text" | "call";
export type FormQuestionType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multi_choice"
  | "scale";
export type FeedbackDraftStatus = "pending_review" | "published" | "rejected";

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
          onboarding_completed: boolean;
          cal_username: string | null;
          mentor_style_notes: string | null;
          internal_notes: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean;
          cal_username?: string | null;
          mentor_style_notes?: string | null;
          internal_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean;
          cal_username?: string | null;
          mentor_style_notes?: string | null;
          internal_notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      paths: {
        Row: {
          id: string;
          student_id: string;
          created_by: string | null;
          title: string;
          description: string | null;
          goal: string | null;
          start_date: string | null;
          end_date: string | null;
          duration_label: string | null;
          status: PathStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          created_by?: string | null;
          title: string;
          description?: string | null;
          goal?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          duration_label?: string | null;
          status?: PathStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          created_by?: string | null;
          title?: string;
          description?: string | null;
          goal?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          duration_label?: string | null;
          status?: PathStatus;
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
          resource_url?: string | null;
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
          node_id: string;
          student_id: string;
          video_url: string | null;
          notes: string | null;
          ai_summary: string | null;
          status: CheckInStatus;
          kind: CheckInKind;
          created_at: string;
        };
        Insert: {
          id?: string;
          node_id: string;
          student_id: string;
          video_url?: string | null;
          notes?: string | null;
          ai_summary?: string | null;
          status?: CheckInStatus;
          kind?: CheckInKind;
          created_at?: string;
        };
        Update: {
          id?: string;
          node_id?: string;
          student_id?: string;
          video_url?: string | null;
          notes?: string | null;
          ai_summary?: string | null;
          status?: CheckInStatus;
          kind?: CheckInKind;
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
    };
    Views: Record<never, never>;
    Functions: {
      is_mentor: {
        Args: Record<string, never>;
        Returns: boolean;
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
    };
  };
}
