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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievement_definitions: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          requirement_type: string
          requirement_value: number | null
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          requirement_type: string
          requirement_value?: number | null
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          requirement_type?: string
          requirement_value?: number | null
          slug?: string
        }
        Relationships: []
      }
      app_notices: {
        Row: {
          action_url: string | null
          created_at: string
          force_update: boolean
          id: string
          is_active: boolean
          kind: string
          latest_app_version: string | null
          message: string
          min_app_version: string | null
          title: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          force_update?: boolean
          id?: string
          is_active?: boolean
          kind?: string
          latest_app_version?: string | null
          message: string
          min_app_version?: string | null
          title: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          force_update?: boolean
          id?: string
          is_active?: boolean
          kind?: string
          latest_app_version?: string | null
          message?: string
          min_app_version?: string | null
          title?: string
        }
        Relationships: []
      }
      body_measurement_logs: {
        Row: {
          body_fat_percent: number | null
          chest_cm: number | null
          created_at: string
          hips_cm: number | null
          id: string
          left_arm_cm: number | null
          left_thigh_cm: number | null
          logged_at: string
          note: string | null
          right_arm_cm: number | null
          right_thigh_cm: number | null
          shoulders_cm: number | null
          source: string
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          body_fat_percent?: number | null
          chest_cm?: number | null
          created_at?: string
          hips_cm?: number | null
          id?: string
          left_arm_cm?: number | null
          left_thigh_cm?: number | null
          logged_at?: string
          note?: string | null
          right_arm_cm?: number | null
          right_thigh_cm?: number | null
          shoulders_cm?: number | null
          source?: string
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          body_fat_percent?: number | null
          chest_cm?: number | null
          created_at?: string
          hips_cm?: number | null
          id?: string
          left_arm_cm?: number | null
          left_thigh_cm?: number | null
          logged_at?: string
          note?: string | null
          right_arm_cm?: number | null
          right_thigh_cm?: number | null
          shoulders_cm?: number | null
          source?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      challenge_definitions: {
        Row: {
          challenge_type: string
          created_at: string
          description: string | null
          duration_type: string
          id: string
          is_active: boolean
          target_value: number
          title: string
        }
        Insert: {
          challenge_type: string
          created_at?: string
          description?: string | null
          duration_type: string
          id?: string
          is_active?: boolean
          target_value: number
          title: string
        }
        Update: {
          challenge_type?: string
          created_at?: string
          description?: string | null
          duration_type?: string
          id?: string
          is_active?: boolean
          target_value?: number
          title?: string
        }
        Relationships: []
      }
      coach_conversations: {
        Row: {
          context: Json
          created_at: string
          id: string
          message: string
          role: string
          user_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          message: string
          role: string
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          message?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_insights: {
        Row: {
          created_at: string
          id: string
          insight_type: string
          model_name: string | null
          payload: Json
          source: string
          summary: string
          title: string
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          insight_type: string
          model_name?: string | null
          payload?: Json
          source?: string
          summary: string
          title: string
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          insight_type?: string
          model_name?: string | null
          payload?: Json
          source?: string
          summary?: string
          title?: string
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      coach_profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          apple_health_connected: boolean
          created_at: string
          equipment_notes: string | null
          experience_level: string
          goal: string
          height_cm: number | null
          injury_notes: string | null
          onboarding_completed: boolean
          onboarding_step: string
          primary_goal_notes: string | null
          sex: string | null
          training_days_per_week: number | null
          training_style: string
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          apple_health_connected?: boolean
          created_at?: string
          equipment_notes?: string | null
          experience_level?: string
          goal?: string
          height_cm?: number | null
          injury_notes?: string | null
          onboarding_completed?: boolean
          onboarding_step?: string
          primary_goal_notes?: string | null
          sex?: string | null
          training_days_per_week?: number | null
          training_style?: string
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          apple_health_connected?: boolean
          created_at?: string
          equipment_notes?: string | null
          experience_level?: string
          goal?: string
          height_cm?: number | null
          injury_notes?: string | null
          onboarding_completed?: boolean
          onboarding_step?: string
          primary_goal_notes?: string | null
          sex?: string | null
          training_days_per_week?: number | null
          training_style?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      exercise_prs: {
        Row: {
          created_at: string | null
          exercise_id: string
          id: string
          log_id: string | null
          pr_date: string
          pr_type: string
          pr_value: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          exercise_id: string
          id?: string
          log_id?: string | null
          pr_date?: string
          pr_type: string
          pr_value: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          exercise_id?: string
          id?: string
          log_id?: string | null
          pr_date?: string
          pr_type?: string
          pr_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_prs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_prs_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_tut_logs: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          load_kg: number | null
          note: string | null
          performed_on: string
          reps: number
          rest_seconds: number | null
          rpe: number | null
          sets: number
          tut_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          load_kg?: number | null
          note?: string | null
          performed_on?: string
          reps: number
          rest_seconds?: number | null
          rpe?: number | null
          sets: number
          tut_seconds: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          load_kg?: number | null
          note?: string | null
          performed_on?: string
          reps?: number
          rest_seconds?: number | null
          rpe?: number | null
          sets?: number
          tut_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_tut_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string | null
          split_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug?: string | null
          split_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string | null
          split_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "splits"
            referencedColumns: ["id"]
          },
        ]
      }
      global_program_likes: {
        Row: {
          created_at: string
          global_program_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          global_program_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          global_program_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_program_likes_global_program_id_fkey"
            columns: ["global_program_id"]
            isOneToOne: false
            referencedRelation: "global_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_program_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      global_programs: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          difficulty: string | null
          id: string
          import_count: number
          is_active: boolean
          is_featured: boolean
          like_count: number
          program_id: string
          published_by_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          id?: string
          import_count?: number
          is_active?: boolean
          is_featured?: boolean
          like_count?: number
          program_id: string
          published_by_user_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          id?: string
          import_count?: number
          is_active?: boolean
          is_featured?: boolean
          like_count?: number
          program_id?: string
          published_by_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_programs_published_by_user_id_fkey"
            columns: ["published_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_sync_daily: {
        Row: {
          active_energy_kcal: number | null
          body_mass_kg: number | null
          created_at: string
          exercise_minutes: number | null
          id: string
          raw_payload: Json
          resting_heart_rate: number | null
          sleep_minutes: number | null
          source: string
          stand_hours: number | null
          steps: number | null
          sync_date: string
          updated_at: string
          user_id: string
          walking_heart_rate_avg: number | null
        }
        Insert: {
          active_energy_kcal?: number | null
          body_mass_kg?: number | null
          created_at?: string
          exercise_minutes?: number | null
          id?: string
          raw_payload?: Json
          resting_heart_rate?: number | null
          sleep_minutes?: number | null
          source?: string
          stand_hours?: number | null
          steps?: number | null
          sync_date: string
          updated_at?: string
          user_id: string
          walking_heart_rate_avg?: number | null
        }
        Update: {
          active_energy_kcal?: number | null
          body_mass_kg?: number | null
          created_at?: string
          exercise_minutes?: number | null
          id?: string
          raw_payload?: Json
          resting_heart_rate?: number | null
          sleep_minutes?: number | null
          source?: string
          stand_hours?: number | null
          steps?: number | null
          sync_date?: string
          updated_at?: string
          user_id?: string
          walking_heart_rate_avg?: number | null
        }
        Relationships: []
      }
      logs: {
        Row: {
          created_at: string | null
          day: string | null
          exercise_id: string
          id: string
          log_date: string
          reps: number
          rpe: number | null
          sets: number
          type: string | null
          user_id: string
          volume: number | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          day?: string | null
          exercise_id: string
          id?: string
          log_date?: string
          reps: number
          rpe?: number | null
          sets: number
          type?: string | null
          user_id?: string
          volume?: number | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          day?: string | null
          exercise_id?: string
          id?: string
          log_date?: string
          reps?: number
          rpe?: number | null
          sets?: number
          type?: string | null
          user_id?: string
          volume?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_training_reviews: {
        Row: {
          ai_feedback: Json | null
          created_at: string | null
          id: string
          program_id: string | null
          review_month: string
          stats: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_feedback?: Json | null
          created_at?: string | null
          id?: string
          program_id?: string | null
          review_month: string
          stats?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_feedback?: Json | null
          created_at?: string | null
          id?: string
          program_id?: string | null
          review_month?: string
          stats?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_training_reviews_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          current_program_id: string | null
          current_split_order: number | null
          display_name: string | null
          expo_push_token: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          current_program_id?: string | null
          current_split_order?: number | null
          display_name?: string | null
          expo_push_token?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          current_program_id?: string | null
          current_split_order?: number | null
          display_name?: string | null
          expo_push_token?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_current_program"
            columns: ["current_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_cycles: {
        Row: {
          cycle_index: number
          ended_at: string | null
          id: string
          is_active: boolean
          program_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          cycle_index?: number
          ended_at?: string | null
          id?: string
          is_active?: boolean
          program_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          cycle_index?: number
          ended_at?: string | null
          id?: string
          is_active?: boolean
          program_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_cycles_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_imports: {
        Row: {
          created_at: string
          id: string
          imported_by_user_id: string
          program_id: string
          share_id: string | null
          shared_by_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          imported_by_user_id: string
          program_id: string
          share_id?: string | null
          shared_by_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          imported_by_user_id?: string
          program_id?: string
          share_id?: string | null
          shared_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_imports_imported_by_user_id_fkey"
            columns: ["imported_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_imports_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_imports_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "program_shares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_imports_shared_by_user_id_fkey"
            columns: ["shared_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      program_shares: {
        Row: {
          created_at: string
          id: string
          program_id: string
          program_name_snapshot: string | null
          shared_by_user_id: string
          shared_by_username_snapshot: string | null
          shared_with_user_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          program_name_snapshot?: string | null
          shared_by_user_id: string
          shared_by_username_snapshot?: string | null
          shared_with_user_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          program_name_snapshot?: string | null
          shared_by_user_id?: string
          shared_by_username_snapshot?: string | null
          shared_with_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_shares_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_shares_shared_by_user_id_fkey"
            columns: ["shared_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_shares_shared_with_user_id_fkey"
            columns: ["shared_with_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          schedule_anchor_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          schedule_anchor_date?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          schedule_anchor_date?: string
          user_id?: string
        }
        Relationships: []
      }
      recovery_checkins: {
        Row: {
          active_energy_kcal: number | null
          checkin_date: string
          created_at: string
          energy_level: number | null
          id: string
          motivation_level: number | null
          note: string | null
          resting_heart_rate: number | null
          sleep_hours: number | null
          soreness_level: number | null
          steps: number | null
          stress_level: number | null
          user_id: string
        }
        Insert: {
          active_energy_kcal?: number | null
          checkin_date?: string
          created_at?: string
          energy_level?: number | null
          id?: string
          motivation_level?: number | null
          note?: string | null
          resting_heart_rate?: number | null
          sleep_hours?: number | null
          soreness_level?: number | null
          steps?: number | null
          stress_level?: number | null
          user_id: string
        }
        Update: {
          active_energy_kcal?: number | null
          checkin_date?: string
          created_at?: string
          energy_level?: number | null
          id?: string
          motivation_level?: number | null
          note?: string | null
          resting_heart_rate?: number | null
          sleep_hours?: number | null
          soreness_level?: number | null
          steps?: number | null
          stress_level?: number | null
          user_id?: string
        }
        Relationships: []
      }
      skill_logs: {
        Row: {
          attempts: number | null
          created_at: string
          exercise_id: string | null
          id: string
          logged_at: string
          notes: string | null
          skill_id: string
          stage_id: string | null
          unit: string | null
          user_id: string
          user_skill_id: string
          value: number | null
          workout_session_id: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          exercise_id?: string | null
          id?: string
          logged_at?: string
          notes?: string | null
          skill_id: string
          stage_id?: string | null
          unit?: string | null
          user_id: string
          user_skill_id: string
          value?: number | null
          workout_session_id?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string
          exercise_id?: string | null
          id?: string
          logged_at?: string
          notes?: string | null
          skill_id?: string
          stage_id?: string | null
          unit?: string | null
          user_id?: string
          user_skill_id?: string
          value?: number | null
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_logs_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_logs_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "skill_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_logs_user_skill_id_fkey"
            columns: ["user_skill_id"]
            isOneToOne: false
            referencedRelation: "user_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_logs_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_resources: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          order_index: number
          resource_type: string
          skill_id: string
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          resource_type: string
          skill_id: string
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          resource_type?: string
          skill_id?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_resources_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_stages: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          skill_id: string
          target_value: number | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index: number
          skill_id: string
          target_value?: number | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          skill_id?: string
          target_value?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_stages_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string
          created_at: string
          difficulty: string
          id: string
          is_active: boolean
          metric_type: string
          name: string
          short_description: string | null
          slug: string
        }
        Insert: {
          category: string
          created_at?: string
          difficulty: string
          id?: string
          is_active?: boolean
          metric_type: string
          name: string
          short_description?: string | null
          slug: string
        }
        Update: {
          category?: string
          created_at?: string
          difficulty?: string
          id?: string
          is_active?: boolean
          metric_type?: string
          name?: string
          short_description?: string | null
          slug?: string
        }
        Relationships: []
      }
      splits: {
        Row: {
          created_at: string | null
          focus: string | null
          id: string
          is_rest_day: boolean
          name: string
          order_index: number
          program_id: string
          rest_activity_label: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          focus?: string | null
          id?: string
          is_rest_day?: boolean
          name: string
          order_index?: number
          program_id: string
          rest_activity_label?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          focus?: string | null
          id?: string
          is_rest_day?: boolean
          name?: string
          order_index?: number
          program_id?: string
          rest_activity_label?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "splits_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenges: {
        Row: {
          challenge_id: string
          completed_at: string | null
          created_at: string
          ends_at: string
          id: string
          progress_value: number
          starts_at: string
          status: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          progress_value?: number
          starts_at: string
          status?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          progress_value?: number
          starts_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenge_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notice_dismissals: {
        Row: {
          created_at: string | null
          id: string
          notice_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notice_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notice_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notice_dismissals_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "app_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_skill_milestones: {
        Row: {
          achieved_at: string
          best_value: number | null
          id: string
          note: string | null
          skill_id: string
          stage_id: string
          user_id: string
          user_skill_id: string
        }
        Insert: {
          achieved_at?: string
          best_value?: number | null
          id?: string
          note?: string | null
          skill_id: string
          stage_id: string
          user_id: string
          user_skill_id: string
        }
        Update: {
          achieved_at?: string
          best_value?: number | null
          id?: string
          note?: string | null
          skill_id?: string
          stage_id?: string
          user_id?: string
          user_skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skill_milestones_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skill_milestones_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "skill_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skill_milestones_user_skill_id_fkey"
            columns: ["user_skill_id"]
            isOneToOne: false
            referencedRelation: "user_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      user_skills: {
        Row: {
          created_at: string
          current_stage_id: string | null
          id: string
          is_favorite: boolean
          last_logged_at: string | null
          skill_id: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_stage_id?: string | null
          id?: string
          is_favorite?: boolean
          last_logged_at?: string | null
          skill_id: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_stage_id?: string | null
          id?: string
          is_favorite?: boolean
          last_logged_at?: string | null
          skill_id?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "skill_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          completed_at: string | null
          cycle_id: string | null
          id: string
          program_id: string | null
          session_type: string
          source: string
          split_id: string | null
          status: string
          user_id: string
          workout_date: string
        }
        Insert: {
          completed_at?: string | null
          cycle_id?: string | null
          id?: string
          program_id?: string | null
          session_type?: string
          source?: string
          split_id?: string | null
          status?: string
          user_id: string
          workout_date: string
        }
        Update: {
          completed_at?: string | null
          cycle_id?: string | null
          id?: string
          program_id?: string | null
          session_type?: string
          source?: string
          split_id?: string | null
          status?: string
          user_id?: string
          workout_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_cycle_fk"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "program_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_latest_body_measurements: {
        Row: {
          body_fat_percent: number | null
          chest_cm: number | null
          created_at: string | null
          hips_cm: number | null
          id: string | null
          left_arm_cm: number | null
          left_thigh_cm: number | null
          logged_at: string | null
          note: string | null
          right_arm_cm: number | null
          right_thigh_cm: number | null
          shoulders_cm: number | null
          source: string | null
          user_id: string | null
          waist_cm: number | null
          weight_kg: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_program_share: {
        Args: { p_share_id: string }
        Returns: {
          import_id: string
          imported_program_id: string
          share_id: string
        }[]
      }
      cleanup_workout_sessions_90d: { Args: never; Returns: undefined }
      decline_program_share: { Args: { p_share_id: string }; Returns: string }
      reorder_splits: {
        Args: { split_ids: string[]; user_uuid: string }
        Returns: undefined
      }
      search_profiles_by_username: {
        Args: { q: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          username: string
        }[]
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
