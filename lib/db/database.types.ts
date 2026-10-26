
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "item_feelings": {
                  Row: {
                    "audio_path": string | null,"created_at": string,"id": string,"item_id": string,"parsed_at": string | null,"raw_text": string,"source": string,"structured": Json | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audio_path"?: string | null,"created_at"?: string,"id"?: string,"item_id": string,"parsed_at"?: string | null,"raw_text": string,"source": string,"structured"?: Json | null,"user_id": string
                  }
                  Update: {
                    "audio_path"?: string | null,"created_at"?: string,"id"?: string,"item_id"?: string,"parsed_at"?: string | null,"raw_text"?: string,"source"?: string,"structured"?: Json | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_feelings_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_feelings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"items": {
                  Row: {
                    "ai_tags": Json | null,"brand": string | null,"category": string,"created_at": string,"currency": string | null,"entry_method": string,"id": string,"image_paths": (string)[],"on_model": boolean | null,"price_cents": number | null,"raw_source": Json | null,"retailer": string | null,"source_url": string | null,"status": string,"title": string,"updated_at": string,"user_id": string,"user_tags": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_tags"?: Json | null,"brand"?: string | null,"category": string,"created_at"?: string,"currency"?: string | null,"entry_method": string,"id"?: string,"image_paths"?: (string)[],"on_model"?: boolean | null,"price_cents"?: number | null,"raw_source"?: Json | null,"retailer"?: string | null,"source_url"?: string | null,"status"?: string,"title": string,"updated_at"?: string,"user_id": string,"user_tags"?: NonNullable<Json>
                  }
                  Update: {
                    "ai_tags"?: Json | null,"brand"?: string | null,"category"?: string,"created_at"?: string,"currency"?: string | null,"entry_method"?: string,"id"?: string,"image_paths"?: (string)[],"on_model"?: boolean | null,"price_cents"?: number | null,"raw_source"?: Json | null,"retailer"?: string | null,"source_url"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string,"user_tags"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"outfit_logs": {
                  Row: {
                    "created_at": string,"id": string,"item_ids": (string)[],"occasion": string | null,"user_id": string,"worn_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"item_ids"?: (string)[],"occasion"?: string | null,"user_id": string,"worn_on": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"item_ids"?: (string)[],"occasion"?: string | null,"user_id"?: string,"worn_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outfit_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"pairings": {
                  Row: {
                    "created_at": string,"id": string,"item_a_id": string,"item_b_id": string,"pairs": boolean,"prompt_version": string | null,"reason": string | null,"source": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"item_a_id": string,"item_b_id": string,"pairs": boolean,"prompt_version"?: string | null,"reason"?: string | null,"source": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"item_a_id"?: string,"item_b_id"?: string,"pairs"?: boolean,"prompt_version"?: string | null,"reason"?: string | null,"source"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pairings_item_a_id_fkey"
      columns: ["item_a_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pairings_item_b_id_fkey"
      columns: ["item_b_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pairings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"resale_buyers": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"preferences": NonNullable<Json>,"profile": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"preferences"?: NonNullable<Json>,"profile"?: NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"preferences"?: NonNullable<Json>,"profile"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"style_profiles": {
                  Row: {
                    "avoid": NonNullable<Json>,"evidence": NonNullable<Json>,"frequent_occasions": NonNullable<Json>,"generated_at": string,"id": string,"suits": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avoid"?: NonNullable<Json>,"evidence"?: NonNullable<Json>,"frequent_occasions"?: NonNullable<Json>,"generated_at"?: string,"id"?: string,"suits"?: NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "avoid"?: NonNullable<Json>,"evidence"?: NonNullable<Json>,"frequent_occasions"?: NonNullable<Json>,"generated_at"?: string,"id"?: string,"suits"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "style_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "body_shape": string | null,"bust_cm": number | null,"created_at": string,"display_name": string,"height_cm": number | null,"hip_cm": number | null,"id": string,"inseam_cm": number | null,"is_seed": boolean,"lifestyle_mix": NonNullable<Json>,"resale_opt_in": boolean,"updated_at": string,"waist_cm": number | null,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body_shape"?: string | null,"bust_cm"?: number | null,"created_at"?: string,"display_name": string,"height_cm"?: number | null,"hip_cm"?: number | null,"id"?: string,"inseam_cm"?: number | null,"is_seed"?: boolean,"lifestyle_mix"?: NonNullable<Json>,"resale_opt_in"?: boolean,"updated_at"?: string,"waist_cm"?: number | null,"weight_kg"?: number | null
                  }
                  Update: {
                    "body_shape"?: string | null,"bust_cm"?: number | null,"created_at"?: string,"display_name"?: string,"height_cm"?: number | null,"hip_cm"?: number | null,"id"?: string,"inseam_cm"?: number | null,"is_seed"?: boolean,"lifestyle_mix"?: NonNullable<Json>,"resale_opt_in"?: boolean,"updated_at"?: string,"waist_cm"?: number | null,"weight_kg"?: number | null
                  }
                  Relationships: [
                    
                  ]
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
