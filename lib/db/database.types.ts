
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
            "ai_budget_days": {
                  Row: {
                    "day": string,"spent_usd": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"spent_usd"?: number,"updated_at"?: string
                  }
                  Update: {
                    "day"?: string,"spent_usd"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_usage_days": {
                  Row: {
                    "action": string,"count": number,"day": string,"subject": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"count"?: number,"day": string,"subject": string,"updated_at"?: string
                  }
                  Update: {
                    "action"?: string,"count"?: number,"day"?: string,"subject"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"item_feelings": {
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
                    "ai_tags": Json | null,"asking_price_cents": number | null,"brand": string | null,"category": string,"condition": string | null,"created_at": string,"currency": string | null,"entry_method": string,"id": string,"image_paths": (string)[],"on_model": boolean | null,"price_cents": number | null,"raw_source": Json | null,"retailer": string | null,"size": string | null,"source_url": string | null,"status": string,"title": string,"updated_at": string,"user_id": string,"user_tags": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_tags"?: Json | null,"asking_price_cents"?: number | null,"brand"?: string | null,"category": string,"condition"?: string | null,"created_at"?: string,"currency"?: string | null,"entry_method": string,"id"?: string,"image_paths"?: (string)[],"on_model"?: boolean | null,"price_cents"?: number | null,"raw_source"?: Json | null,"retailer"?: string | null,"size"?: string | null,"source_url"?: string | null,"status"?: string,"title": string,"updated_at"?: string,"user_id": string,"user_tags"?: NonNullable<Json>
                  }
                  Update: {
                    "ai_tags"?: Json | null,"asking_price_cents"?: number | null,"brand"?: string | null,"category"?: string,"condition"?: string | null,"created_at"?: string,"currency"?: string | null,"entry_method"?: string,"id"?: string,"image_paths"?: (string)[],"on_model"?: boolean | null,"price_cents"?: number | null,"raw_source"?: Json | null,"retailer"?: string | null,"size"?: string | null,"source_url"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string,"user_tags"?: NonNullable<Json>
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
                },"resale_matches": {
                  Row: {
                    "buyer_id": string,"buyer_reasons": (string)[],"checked_at": string,"fingerprint": string,"highlights": (string)[],"item_id": string,"score": number,"seller_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id": string,"buyer_reasons"?: (string)[],"checked_at"?: string,"fingerprint": string,"highlights"?: (string)[],"item_id": string,"score": number,"seller_id": string
                  }
                  Update: {
                    "buyer_id"?: string,"buyer_reasons"?: (string)[],"checked_at"?: string,"fingerprint"?: string,"highlights"?: (string)[],"item_id"?: string,"score"?: number,"seller_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resale_matches_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "resale_matches_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "resale_matches_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"style_profiles": {
                  Row: {
                    "avoid": NonNullable<Json>,"evidence": NonNullable<Json>,"frequent_occasions": NonNullable<Json>,"generated_at": string,"generating_since": string | null,"generating_token": string | null,"headline": Json | null,"id": string,"input_hash": string | null,"prompt_version": string | null,"suits": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avoid"?: NonNullable<Json>,"evidence"?: NonNullable<Json>,"frequent_occasions"?: NonNullable<Json>,"generated_at"?: string,"generating_since"?: string | null,"generating_token"?: string | null,"headline"?: Json | null,"id"?: string,"input_hash"?: string | null,"prompt_version"?: string | null,"suits"?: NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "avoid"?: NonNullable<Json>,"evidence"?: NonNullable<Json>,"frequent_occasions"?: NonNullable<Json>,"generated_at"?: string,"generating_since"?: string | null,"generating_token"?: string | null,"headline"?: Json | null,"id"?: string,"input_hash"?: string | null,"prompt_version"?: string | null,"suits"?: NonNullable<Json>,"user_id"?: string
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
                    "body_shape": string | null,"bottom_size": string | null,"bust_cm": number | null,"created_at": string,"display_name": string,"height_cm": number | null,"hip_cm": number | null,"id": string,"inseam_cm": number | null,"is_seed": boolean,"lifestyle_mix": NonNullable<Json>,"resale_opt_in": boolean,"shoe_size": string | null,"temp_unit": string | null,"top_size": string | null,"updated_at": string,"waist_cm": number | null,"wear_log_enabled": boolean,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body_shape"?: string | null,"bottom_size"?: string | null,"bust_cm"?: number | null,"created_at"?: string,"display_name": string,"height_cm"?: number | null,"hip_cm"?: number | null,"id"?: string,"inseam_cm"?: number | null,"is_seed"?: boolean,"lifestyle_mix"?: NonNullable<Json>,"resale_opt_in"?: boolean,"shoe_size"?: string | null,"temp_unit"?: string | null,"top_size"?: string | null,"updated_at"?: string,"waist_cm"?: number | null,"wear_log_enabled"?: boolean,"weight_kg"?: number | null
                  }
                  Update: {
                    "body_shape"?: string | null,"bottom_size"?: string | null,"bust_cm"?: number | null,"created_at"?: string,"display_name"?: string,"height_cm"?: number | null,"hip_cm"?: number | null,"id"?: string,"inseam_cm"?: number | null,"is_seed"?: boolean,"lifestyle_mix"?: NonNullable<Json>,"resale_opt_in"?: boolean,"shoe_size"?: string | null,"temp_unit"?: string | null,"top_size"?: string | null,"updated_at"?: string,"waist_cm"?: number | null,"wear_log_enabled"?: boolean,"weight_kg"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"wear_insights": {
                  Row: {
                    "generated_at": string,"input_hash": string,"insights": NonNullable<Json>,"prompt_version": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "generated_at"?: string,"input_hash": string,"insights": NonNullable<Json>,"prompt_version": string,"user_id": string
                  }
                  Update: {
                    "generated_at"?: string,"input_hash"?: string,"insights"?: NonNullable<Json>,"prompt_version"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wear_insights_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "ai_give_back":
{ Args: { "p_action": string,"p_day": string,"p_subject": string }; Returns: undefined
                           },
"ai_reserve":
{ Args: { "p_day": string,"p_limit": number,"p_usd": number }; Returns: boolean
                           },
"ai_settle":
{ Args: { "p_day": string,"p_usd": number }; Returns: undefined
                           },
"ai_take":
{ Args: { "p_action": string,"p_day": string,"p_limit": number,"p_subject": string }; Returns: boolean
                           },
"orphan_item_images":
{ Args: { "p_before": string,"p_limit": number,"p_prefix"?: string }; Returns: string[]
                           },
"rename_email_named_users":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"style_profile_claim":
{ Args: { "p_cooldown": string,"p_hash": string,"p_user": string }; Returns: string
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
