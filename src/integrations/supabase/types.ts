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
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          extracted_text: string
          file_name: string
          id: string
          page_count: number
          storage_path: string
          subject: Database["public"]["Enums"]["subject"]
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string
          file_name: string
          id?: string
          page_count?: number
          storage_path: string
          subject: Database["public"]["Enums"]["subject"]
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string
          file_name?: string
          id?: string
          page_count?: number
          storage_path?: string
          subject?: Database["public"]["Enums"]["subject"]
          user_id?: string
        }
        Relationships: []
      }
      exam_attempts: {
        Row: {
          correct_count: number
          created_at: string
          details: Json
          id: string
          score_pct: number
          subjects: Database["public"]["Enums"]["subject"][]
          time_limit_seconds: number
          time_used_seconds: number
          total_questions: number
          user_id: string
        }
        Insert: {
          correct_count: number
          created_at?: string
          details?: Json
          id?: string
          score_pct: number
          subjects: Database["public"]["Enums"]["subject"][]
          time_limit_seconds: number
          time_used_seconds: number
          total_questions: number
          user_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          details?: Json
          id?: string
          score_pct?: number
          subjects?: Database["public"]["Enums"]["subject"][]
          time_limit_seconds?: number
          time_used_seconds?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      flashcard_reviews: {
        Row: {
          created_at: string
          due_at: string
          ease_factor: number
          id: string
          interval_days: number
          last_rating: string | null
          last_reviewed_at: string | null
          question_id: string
          repetitions: number
          user_id: string
        }
        Insert: {
          created_at?: string
          due_at?: string
          ease_factor?: number
          id?: string
          interval_days?: number
          last_rating?: string | null
          last_reviewed_at?: string | null
          question_id: string
          repetitions?: number
          user_id: string
        }
        Update: {
          created_at?: string
          due_at?: string
          ease_factor?: number
          id?: string
          interval_days?: number
          last_rating?: string | null
          last_reviewed_at?: string | null
          question_id?: string
          repetitions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      question_answers: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          source: string
          subject: Database["public"]["Enums"]["subject"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          source?: string
          subject: Database["public"]["Enums"]["subject"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          source?: string
          subject?: Database["public"]["Enums"]["subject"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          correct_index: number
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty"]
          document_id: string | null
          explanation: string
          id: string
          options: Json
          question_text: string
          reference: string | null
          source: string
          subject: Database["public"]["Enums"]["subject"]
          user_id: string
        }
        Insert: {
          correct_index: number
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"]
          document_id?: string | null
          explanation?: string
          id?: string
          options: Json
          question_text: string
          reference?: string | null
          source?: string
          subject: Database["public"]["Enums"]["subject"]
          user_id: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"]
          document_id?: string | null
          explanation?: string
          id?: string
          options?: Json
          question_text?: string
          reference?: string | null
          source?: string
          subject?: Database["public"]["Enums"]["subject"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      study_progress: {
        Row: {
          consecutive_correct: number
          created_at: string
          ease_factor: number
          id: string
          interval_days: number
          last_seen_at: string | null
          next_review_at: string
          question_id: string
          repetitions: number
          status: string
          times_correct: number
          times_seen: number
          times_wrong: number
          updated_at: string
          user_id: string
        }
        Insert: {
          consecutive_correct?: number
          created_at?: string
          ease_factor?: number
          id?: string
          interval_days?: number
          last_seen_at?: string | null
          next_review_at?: string
          question_id: string
          repetitions?: number
          status?: string
          times_correct?: number
          times_seen?: number
          times_wrong?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          consecutive_correct?: number
          created_at?: string
          ease_factor?: number
          id?: string
          interval_days?: number
          last_seen_at?: string | null
          next_review_at?: string
          question_id?: string
          repetitions?: number
          status?: string
          times_correct?: number
          times_seen?: number
          times_wrong?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          ended_at: string | null
          id: string
          mastered_count: number
          pending_question_ids: Json
          review_count: number
          started_at: string
          subjects: Json
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          mastered_count?: number
          pending_question_ids?: Json
          review_count?: number
          started_at?: string
          subjects?: Json
          user_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          mastered_count?: number
          pending_question_ids?: Json
          review_count?: number
          started_at?: string
          subjects?: Json
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      difficulty: "fácil" | "medio" | "difícil"
      subject:
        | "Meteorología"
        | "Navegación"
        | "Reglamentación RAB/ICAO"
        | "Performance y Peso"
        | "Sistemas de Aeronave"
        | "Comunicaciones"
        | "Factores Humanos"
        | "Procedimientos IFR"
        | "Navegación Aérea"
        | "Reglamentación RAB / Legislación Aeronáutica"
        | "Performance y Peso y Balance"
        | "Comunicaciones y ATC"
        | "Factores Humanos y Fisiología"
        | "Aerodinámica y Principios de Vuelo"
        | "Operaciones Aeronáuticas"
        | "Espacio Aéreo"
        | "Reglamentación OACI / Anexos"
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
      difficulty: ["fácil", "medio", "difícil"],
      subject: [
        "Meteorología",
        "Navegación",
        "Reglamentación RAB/ICAO",
        "Performance y Peso",
        "Sistemas de Aeronave",
        "Comunicaciones",
        "Factores Humanos",
        "Procedimientos IFR",
        "Navegación Aérea",
        "Reglamentación RAB / Legislación Aeronáutica",
        "Performance y Peso y Balance",
        "Comunicaciones y ATC",
        "Factores Humanos y Fisiología",
        "Aerodinámica y Principios de Vuelo",
        "Operaciones Aeronáuticas",
        "Espacio Aéreo",
        "Reglamentación OACI / Anexos",
      ],
    },
  },
} as const
