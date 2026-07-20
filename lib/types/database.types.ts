// Tipos da base de dados Neuma.
// Escritos a mao a partir de supabase/migrations/0001_init.sql.
// Podem ser regenerados com: supabase gen types typescript

export type UserRole = "mentor" | "student";
export type NodeStatus = "locked" | "active" | "completed";
export type CheckInStatus = "pending" | "approved" | "needs_revision";

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
          created_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          created_by?: string | null;
          title: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          created_by?: string | null;
          title?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      nodes: {
        Row: {
          id: string;
          path_id: string;
          title: string;
          description: string | null;
          order_index: number;
          status: NodeStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          path_id: string;
          title: string;
          description?: string | null;
          order_index: number;
          status?: NodeStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          path_id?: string;
          title?: string;
          description?: string | null;
          order_index?: number;
          status?: NodeStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      check_ins: {
        Row: {
          id: string;
          node_id: string;
          student_id: string;
          video_url: string;
          notes: string | null;
          ai_summary: string | null;
          status: CheckInStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          node_id: string;
          student_id: string;
          video_url: string;
          notes?: string | null;
          ai_summary?: string | null;
          status?: CheckInStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          node_id?: string;
          student_id?: string;
          video_url?: string;
          notes?: string | null;
          ai_summary?: string | null;
          status?: CheckInStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      feedbacks: {
        Row: {
          id: string;
          check_in_id: string;
          mentor_id: string;
          video_url: string | null;
          notes: string | null;
          approved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          check_in_id: string;
          mentor_id: string;
          video_url?: string | null;
          notes?: string | null;
          approved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          check_in_id?: string;
          mentor_id?: string;
          video_url?: string | null;
          notes?: string | null;
          approved?: boolean;
          created_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
    };
  };
}
