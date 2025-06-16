export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      active_admin_sessions: {
        Row: {
          admin_id_text: string
          created_at: string | null
          expires_at: string
          session_token: string
        }
        Insert: {
          admin_id_text: string
          created_at?: string | null
          expires_at: string
          session_token: string
        }
        Update: {
          admin_id_text?: string
          created_at?: string | null
          expires_at?: string
          session_token?: string
        }
        Relationships: []
      }
      admins: {
        Row: {
          admin_identifier: string
          created_at: string | null
          id: string
          name: string | null
        }
        Insert: {
          admin_identifier: string
          created_at?: string | null
          id?: string
          name?: string | null
        }
        Update: {
          admin_identifier?: string
          created_at?: string | null
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          account_creation: string | null
          account_start: string | null
          account_status: string | null
          address: string | null
          admin_id: string
          adstera_api_key: string | null
          adstera_email_link: string | null
          adstera_link: string | null
          api_country_breakdown: Json | null
          api_error_message: string | null
          api_revenue_pkr: number | null
          api_revenue_usd: number | null
          api_total_impressions: number | null
          apify_accounts: number | null
          created_at: string | null
          email: string
          id: string
          last_api_check: string | null
          mobile: string
          monthly_revenue: Json | null
          multi_account_no: string | null
          name: string
          revenue_source: string | null
          updated_at: string | null
          webmoney: string | null
        }
        Insert: {
          account_creation?: string | null
          account_start?: string | null
          account_status?: string | null
          address?: string | null
          admin_id: string
          adstera_api_key?: string | null
          adstera_email_link?: string | null
          adstera_link?: string | null
          api_country_breakdown?: Json | null
          api_error_message?: string | null
          api_revenue_pkr?: number | null
          api_revenue_usd?: number | null
          api_total_impressions?: number | null
          apify_accounts?: number | null
          created_at?: string | null
          email: string
          id?: string
          last_api_check?: string | null
          mobile: string
          monthly_revenue?: Json | null
          multi_account_no?: string | null
          name: string
          revenue_source?: string | null
          updated_at?: string | null
          webmoney?: string | null
        }
        Update: {
          account_creation?: string | null
          account_start?: string | null
          account_status?: string | null
          address?: string | null
          admin_id?: string
          adstera_api_key?: string | null
          adstera_email_link?: string | null
          adstera_link?: string | null
          api_country_breakdown?: Json | null
          api_error_message?: string | null
          api_revenue_pkr?: number | null
          api_revenue_usd?: number | null
          api_total_impressions?: number | null
          apify_accounts?: number | null
          created_at?: string | null
          email?: string
          id?: string
          last_api_check?: string | null
          mobile?: string
          monthly_revenue?: Json | null
          multi_account_no?: string | null
          name?: string
          revenue_source?: string | null
          updated_at?: string | null
          webmoney?: string | null
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
