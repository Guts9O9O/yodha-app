CREATE TYPE "public"."benchmark_better" AS ENUM('lower', 'higher');--> statement-breakpoint
CREATE TYPE "public"."benchmark_value_kind" AS ENUM('time_sec', 'distance_m', 'reps', 'load_kg', 'other');--> statement-breakpoint
CREATE TYPE "public"."checklist_category" AS ENUM('kit', 'admin', 'race_week', 'race_day');--> statement-breakpoint
CREATE TYPE "public"."diet_restriction" AS ENUM('vegetarian');--> statement-breakpoint
CREATE TYPE "public"."diet_rule_kind" AS ENUM('weekday', 'date_range');--> statement-breakpoint
CREATE TYPE "public"."diet_tag" AS ENUM('veg', 'egg', 'chicken', 'fish', 'other_meat');--> statement-breakpoint
CREATE TYPE "public"."effort" AS ENUM('easy', 'moderate', 'max', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('finish', 'medal', 'podium', 'time_target');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('previewed', 'committed', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."meal_type" AS ENUM('breakfast', 'lunch', 'pre_workout', 'post_workout', 'dinner', 'snack');--> statement-breakpoint
CREATE TYPE "public"."onboarding_section" AS ENUM('profile', 'goal', 'health', 'sleep', 'diet', 'cooking', 'partner');--> statement-breakpoint
CREATE TYPE "public"."plan_kind" AS ENUM('training', 'nutrition');--> statement-breakpoint
CREATE TYPE "public"."price_unit" AS ENUM('g', 'kg', 'ml', 'l', 'piece');--> statement-breakpoint
CREATE TYPE "public"."red_flag" AS ENUM('chest_pain', 'fainting', 'dizziness', 'palpitations', 'breathlessness', 'sharp_pain');--> statement-breakpoint
CREATE TYPE "public"."rule_status" AS ENUM('verified', 'unconfirmed', 'contradictory');--> statement-breakpoint
CREATE TYPE "public"."rule_topic" AS ENUM('format', 'general', 'penalty', 'kit', 'hydration', 'station', 'logistics');--> statement-breakpoint
CREATE TYPE "public"."session_type" AS ENUM('run', 'strength', 'station', 'combo', 'mobility', 'rest', 'test');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."sharing_category" AS ENUM('training', 'benchmarks', 'nutrition', 'body_weight', 'checkins');--> statement-breakpoint
CREATE TYPE "public"."station_metric" AS ENUM('distance_m', 'reps');--> statement-breakpoint
CREATE TYPE "public"."switch_mode" AS ENUM('max_switches', 'free', 'swap_zone_only');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."training_experience" AS ENUM('none', 'under_1y', '1_to_3y', 'over_3y');--> statement-breakpoint
CREATE TYPE "public"."version_status" AS ENUM('draft', 'approved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."workout_status" AS ENUM('completed', 'partial', 'skipped');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_profile" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"athlete_key" text NOT NULL,
	"display_name" text NOT NULL,
	"date_of_birth" date,
	"sex" "sex",
	"height_cm" numeric(4, 1),
	"training_experience" "training_experience",
	"availability_days" smallint[] DEFAULT '{}' NOT NULL,
	"availability_start_time" time,
	"availability_max_minutes" smallint,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "athlete_profile_userId_unique" UNIQUE("user_id"),
	CONSTRAINT "athlete_profile_athleteKey_unique" UNIQUE("athlete_key"),
	CONSTRAINT "athlete_profile_key_format" CHECK ("athlete_profile"."athlete_key" ~ '^[a-z][a-z0-9_]{1,30}$'),
	CONSTRAINT "athlete_profile_height_range" CHECK ("athlete_profile"."height_cm" between 100 and 250),
	CONSTRAINT "athlete_profile_availability_days" CHECK ("athlete_profile"."availability_days" <@ array[0,1,2,3,4,5,6]::smallint[]),
	CONSTRAINT "athlete_profile_max_minutes_range" CHECK ("athlete_profile"."availability_max_minutes" between 1 and 600)
);
--> statement-breakpoint
CREATE TABLE "onboarding_response" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"question_set_key" text NOT NULL,
	"question_set_version" smallint NOT NULL,
	"section" "onboarding_section" NOT NULL,
	"answers" jsonb NOT NULL,
	"health_flag" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_response_version_positive" CHECK ("onboarding_response"."question_set_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "sharing_setting" (
	"athlete_id" uuid NOT NULL,
	"category" "sharing_category" NOT NULL,
	"visible_to_team" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sharing_setting_athlete_id_category_pk" PRIMARY KEY("athlete_id","category")
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"created_by_athlete_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invite" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"team_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_by_athlete_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by_athlete_id" uuid,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_invite_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"team_id" uuid NOT NULL,
	"athlete_id" uuid NOT NULL,
	"role" "team_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_member_team_id_athlete_id_pk" PRIMARY KEY("team_id","athlete_id")
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"series" text NOT NULL,
	"season" text,
	"city" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"source_urls" text[] DEFAULT '{}' NOT NULL,
	"verified_at" date,
	"reverify_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_key_unique" UNIQUE("key"),
	CONSTRAINT "event_key_format" CHECK ("event"."key" ~ '^[a-z][a-z0-9_]{1,62}$'),
	CONSTRAINT "event_dates_ordered" CHECK ("event"."end_date" >= "event"."start_date")
);
--> statement-breakpoint
CREATE TABLE "event_category" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"team_size" smallint NOT NULL,
	"run_segment_m" integer,
	"run_segment_count" smallint,
	"medal_cutoff_sec" integer,
	"load_reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_category_key_format" CHECK ("event_category"."key" ~ '^[a-z][a-z0-9_]{1,62}$'),
	CONSTRAINT "event_category_team_size" CHECK ("event_category"."team_size" between 1 and 10),
	CONSTRAINT "event_category_positive_numbers" CHECK ("event_category"."run_segment_m" > 0 and "event_category"."run_segment_count" > 0 and "event_category"."medal_cutoff_sec" > 0)
);
--> statement-breakpoint
CREATE TABLE "goal" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"athlete_id" uuid,
	"team_id" uuid,
	"event_category_id" uuid NOT NULL,
	"goal_type" "goal_type" NOT NULL,
	"target_time_min_sec" integer,
	"target_time_max_sec" integer,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_one_owner" CHECK (num_nonnulls("goal"."athlete_id", "goal"."team_id") = 1),
	CONSTRAINT "goal_times_positive" CHECK ("goal"."target_time_min_sec" > 0 and "goal"."target_time_max_sec" > 0),
	CONSTRAINT "goal_times_ordered" CHECK ("goal"."target_time_min_sec" <= "goal"."target_time_max_sec"),
	CONSTRAINT "goal_time_target_has_time" CHECK ("goal"."goal_type" <> 'time_target' or num_nonnulls("goal"."target_time_min_sec", "goal"."target_time_max_sec") > 0)
);
--> statement-breakpoint
CREATE TABLE "race_entry" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_category_id" uuid NOT NULL,
	"team_id" uuid,
	"athlete_id" uuid,
	"wave_date" date,
	"wave_time" time,
	"reporting_time" time,
	"bib" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "race_entry_one_owner" CHECK (num_nonnulls("race_entry"."team_id", "race_entry"."athlete_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "rule_note" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"event_category_id" uuid,
	"station_id" uuid,
	"key" text NOT NULL,
	"topic" "rule_topic" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" "rule_status" NOT NULL,
	"working_assumption" text,
	"source_url" text,
	"verified_at" date,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_category_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"metric" "station_metric" NOT NULL,
	"target" numeric(8, 2) NOT NULL,
	"load_kg" numeric(6, 2),
	"load_spec" text,
	"equipment_spec" text,
	"movement_standards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"switch_mode" "switch_mode" NOT NULL,
	"max_switches" smallint,
	"partner_position" text,
	"doubles_notes" text,
	"faults" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "station_key_format" CHECK ("station"."key" ~ '^[a-z][a-z0-9_]{1,62}$'),
	CONSTRAINT "station_target_positive" CHECK ("station"."target" > 0),
	CONSTRAINT "station_load_positive" CHECK ("station"."load_kg" > 0),
	CONSTRAINT "station_switch_rule" CHECK (("station"."switch_mode" = 'max_switches') = ("station"."max_switches" is not null)),
	CONSTRAINT "station_max_switches_range" CHECK ("station"."max_switches" >= 0)
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"kind" "plan_kind" NOT NULL,
	"plan_key" text NOT NULL,
	"title" text NOT NULL,
	"owner_athlete_id" uuid,
	"owner_team_id" uuid,
	"event_category_id" uuid,
	"created_by_athlete_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_owner_key_unique" UNIQUE NULLS NOT DISTINCT("kind","owner_athlete_id","owner_team_id","plan_key"),
	CONSTRAINT "plan_one_owner" CHECK (num_nonnulls("plan"."owner_athlete_id", "plan"."owner_team_id") = 1),
	CONSTRAINT "plan_nutrition_owned_by_athlete" CHECK ("plan"."kind" <> 'nutrition' or "plan"."owner_athlete_id" is not null),
	CONSTRAINT "plan_key_format" CHECK ("plan"."plan_key" ~ '^[a-z][a-z0-9_]{1,62}$')
);
--> statement-breakpoint
CREATE TABLE "plan_import" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"imported_by_athlete_id" uuid,
	"kind" "plan_kind",
	"schema_version" smallint,
	"raw_text" text NOT NULL,
	"sha256" text NOT NULL,
	"status" "import_status" NOT NULL,
	"report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	CONSTRAINT "plan_import_size_limit" CHECK (octet_length("plan_import"."raw_text") <= 1048576),
	CONSTRAINT "plan_import_committed_at" CHECK (("plan_import"."status" = 'committed') = ("plan_import"."committed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "plan_version" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"plan_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "version_status" DEFAULT 'draft' NOT NULL,
	"version_note" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"assumptions" text[] DEFAULT '{}' NOT NULL,
	"budget_inr_per_day" numeric(10, 2),
	"import_id" uuid NOT NULL,
	"created_by_athlete_id" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_athlete_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_version_importId_unique" UNIQUE("import_id"),
	CONSTRAINT "plan_version_dates_ordered" CHECK ("plan_version"."end_date" >= "plan_version"."start_date"),
	CONSTRAINT "plan_version_number_positive" CHECK ("plan_version"."version_number" > 0),
	CONSTRAINT "plan_version_approved_at" CHECK ("plan_version"."status" <> 'approved' or "plan_version"."approved_at" is not null),
	CONSTRAINT "plan_version_budget_positive" CHECK ("plan_version"."budget_inr_per_day" > 0)
);
--> statement-breakpoint
CREATE TABLE "plan_version_athlete" (
	"plan_version_id" uuid NOT NULL,
	"athlete_id" uuid NOT NULL,
	CONSTRAINT "plan_version_athlete_plan_version_id_athlete_id_pk" PRIMARY KEY("plan_version_id","athlete_id")
);
--> statement-breakpoint
CREATE TABLE "benchmark" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"benchmark_type_id" uuid NOT NULL,
	"date" date NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"effort" "effort" NOT NULL,
	"conditions" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "benchmark_value_non_negative" CHECK ("benchmark"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "benchmark_type" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"value_kind" "benchmark_value_kind" NOT NULL,
	"better" "benchmark_better" NOT NULL,
	"station_id" uuid,
	"event_category_id" uuid,
	"owner_athlete_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "benchmark_type_owner_key_unique" UNIQUE NULLS NOT DISTINCT("owner_athlete_id","key"),
	CONSTRAINT "benchmark_type_key_format" CHECK ("benchmark_type"."key" ~ '^[a-z][a-z0-9_]{1,62}$')
);
--> statement-breakpoint
CREATE TABLE "exercise_prescription" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"block_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"station_id" uuid,
	"sets" smallint,
	"reps" smallint,
	"distance_m" numeric(8, 1),
	"duration_sec" integer,
	"load_kg" numeric(6, 2),
	"load_guidance" text,
	"rest_sec" integer,
	"target_rpe" text,
	"target_rpe_low" smallint,
	"target_rpe_high" smallint,
	"notes" text,
	"per_athlete" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_prescription_position" CHECK ("exercise_prescription"."position" >= 0),
	CONSTRAINT "exercise_prescription_category_format" CHECK ("exercise_prescription"."category" ~ '^[a-z][a-z0-9_]{1,62}$'),
	CONSTRAINT "exercise_prescription_sets" CHECK ("exercise_prescription"."sets" between 1 and 100),
	CONSTRAINT "exercise_prescription_reps" CHECK ("exercise_prescription"."reps" between 1 and 1000),
	CONSTRAINT "exercise_prescription_distance" CHECK ("exercise_prescription"."distance_m" > 0 and "exercise_prescription"."distance_m" <= 50000),
	CONSTRAINT "exercise_prescription_duration" CHECK ("exercise_prescription"."duration_sec" between 1 and 36000),
	CONSTRAINT "exercise_prescription_load" CHECK ("exercise_prescription"."load_kg" > 0 and "exercise_prescription"."load_kg" <= 500),
	CONSTRAINT "exercise_prescription_rest" CHECK ("exercise_prescription"."rest_sec" between 0 and 3600),
	CONSTRAINT "exercise_prescription_rpe" CHECK ("exercise_prescription"."target_rpe_low" between 1 and 10 and "exercise_prescription"."target_rpe_high" between 1 and 10 and "exercise_prescription"."target_rpe_low" <= "exercise_prescription"."target_rpe_high")
);
--> statement-breakpoint
CREATE TABLE "session_athlete" (
	"session_id" uuid NOT NULL,
	"athlete_id" uuid NOT NULL,
	CONSTRAINT "session_athlete_session_id_athlete_id_pk" PRIMARY KEY("session_id","athlete_id")
);
--> statement-breakpoint
CREATE TABLE "session_block" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"session_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "session_block_position" CHECK ("session_block"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "set_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workout_log_id" uuid NOT NULL,
	"prescription_id" uuid,
	"exercise_position" smallint NOT NULL,
	"exercise_name" text NOT NULL,
	"category" text NOT NULL,
	"set_number" smallint NOT NULL,
	"reps" smallint,
	"load_kg" numeric(6, 2),
	"distance_m" numeric(8, 1),
	"duration_sec" integer,
	"rpe" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "set_log_category_format" CHECK ("set_log"."category" ~ '^[a-z][a-z0-9_]{1,62}$'),
	CONSTRAINT "set_log_numbers" CHECK ("set_log"."exercise_position" >= 0 and "set_log"."set_number" >= 1),
	CONSTRAINT "set_log_non_negative" CHECK ("set_log"."reps" >= 0 and "set_log"."load_kg" >= 0 and "set_log"."distance_m" >= 0 and "set_log"."duration_sec" >= 0),
	CONSTRAINT "set_log_rpe_range" CHECK ("set_log"."rpe" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "training_session" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"date" date NOT NULL,
	"position" smallint NOT NULL,
	"type" "session_type" NOT NULL,
	"title" text NOT NULL,
	"objective" text,
	"estimated_minutes" smallint,
	"joint" boolean DEFAULT false NOT NULL,
	"warmup" text[] DEFAULT '{}' NOT NULL,
	"cooldown" text[] DEFAULT '{}' NOT NULL,
	"recovery" text,
	"stop_criteria" text[] DEFAULT '{}' NOT NULL,
	"lighter_option" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_session_position" CHECK ("training_session"."position" >= 0),
	CONSTRAINT "training_session_minutes_range" CHECK ("training_session"."estimated_minutes" between 1 and 600)
);
--> statement-breakpoint
CREATE TABLE "workout_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"date" date NOT NULL,
	"session_id" uuid,
	"status" "workout_status" NOT NULL,
	"actual_minutes" smallint,
	"session_rpe" smallint,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_log_minutes_range" CHECK ("workout_log"."actual_minutes" between 0 and 1440),
	CONSTRAINT "workout_log_rpe_range" CHECK ("workout_log"."session_rpe" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "diet_rule" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"kind" "diet_rule_kind" NOT NULL,
	"weekday" smallint,
	"start_date" date,
	"end_date" date,
	"restriction" "diet_restriction" NOT NULL,
	"eggs_allowed" boolean,
	"excluded_items" text[] DEFAULT '{}' NOT NULL,
	"note" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diet_rule_shape" CHECK (("diet_rule"."kind" = 'weekday' and "diet_rule"."weekday" is not null and "diet_rule"."weekday" between 0 and 6 and "diet_rule"."start_date" is null and "diet_rule"."end_date" is null)
        or ("diet_rule"."kind" = 'date_range' and "diet_rule"."weekday" is null and "diet_rule"."start_date" is not null and "diet_rule"."end_date" is not null and "diet_rule"."end_date" >= "diet_rule"."start_date"))
);
--> statement-breakpoint
CREATE TABLE "food" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_key_unique" UNIQUE("key"),
	CONSTRAINT "food_key_format" CHECK ("food"."key" ~ '^[a-z][a-z0-9_]{1,62}$')
);
--> statement-breakpoint
CREATE TABLE "food_price" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"food_id" uuid NOT NULL,
	"price_inr" numeric(10, 2) NOT NULL,
	"per_qty" numeric(10, 3) NOT NULL,
	"unit" "price_unit" NOT NULL,
	"grams_per_unit" numeric(10, 3),
	"as_of" date NOT NULL,
	"source" text NOT NULL,
	"is_estimate" boolean NOT NULL,
	"exclude_from_budget" boolean DEFAULT false NOT NULL,
	"import_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_price_positive" CHECK ("food_price"."price_inr" > 0 and "food_price"."per_qty" > 0 and "food_price"."grams_per_unit" > 0),
	CONSTRAINT "food_price_grams_per_unit" CHECK (("food_price"."unit" in ('g', 'kg')) = ("food_price"."grams_per_unit" is null)),
	CONSTRAINT "food_price_source_present" CHECK (length(btrim("food_price"."source")) > 0)
);
--> statement-breakpoint
CREATE TABLE "food_revision" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"food_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"name" text NOT NULL,
	"diet_tag" "diet_tag" NOT NULL,
	"kcal" numeric(7, 2) NOT NULL,
	"protein_g" numeric(6, 2) NOT NULL,
	"carbs_g" numeric(6, 2) NOT NULL,
	"fat_g" numeric(6, 2) NOT NULL,
	"fibre_g" numeric(6, 2),
	"household_measures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL,
	"is_estimate" boolean NOT NULL,
	"content_hash" text NOT NULL,
	"created_by_import_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_revision_number_positive" CHECK ("food_revision"."revision" > 0),
	CONSTRAINT "food_revision_values_non_negative" CHECK ("food_revision"."kcal" >= 0 and "food_revision"."protein_g" >= 0 and "food_revision"."carbs_g" >= 0 and "food_revision"."fat_g" >= 0 and "food_revision"."fibre_g" >= 0),
	CONSTRAINT "food_revision_source_present" CHECK (length(btrim("food_revision"."source")) > 0)
);
--> statement-breakpoint
CREATE TABLE "meal_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal_type" "meal_type" NOT NULL,
	"planned_meal_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_log_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"meal_log_id" uuid NOT NULL,
	"food_revision_id" uuid NOT NULL,
	"planned_item_id" uuid,
	"grams" numeric(7, 1) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_log_item_grams" CHECK ("meal_log_item"."grams" > 0 and "meal_log_item"."grams" <= 5000)
);
--> statement-breakpoint
CREATE TABLE "meal_plan_day" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"athlete_id" uuid NOT NULL,
	"date" date NOT NULL,
	"expected_kcal" numeric(7, 1),
	"expected_protein_g" numeric(6, 1),
	"expected_carbs_g" numeric(6, 1),
	"expected_fat_g" numeric(6, 1),
	"expected_fibre_g" numeric(6, 1),
	"expected_cost_inr" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_plan_day_expected_non_negative" CHECK ("meal_plan_day"."expected_kcal" >= 0 and "meal_plan_day"."expected_protein_g" >= 0 and "meal_plan_day"."expected_carbs_g" >= 0 and "meal_plan_day"."expected_fat_g" >= 0 and "meal_plan_day"."expected_fibre_g" >= 0 and "meal_plan_day"."expected_cost_inr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "nutrition_target" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"plan_version_id" uuid,
	"effective_from" date NOT NULL,
	"kcal_min" numeric(7, 1) NOT NULL,
	"kcal_max" numeric(7, 1) NOT NULL,
	"protein_g_min" numeric(6, 1),
	"protein_g_max" numeric(6, 1),
	"carbs_g_min" numeric(6, 1),
	"carbs_g_max" numeric(6, 1),
	"fat_g_min" numeric(6, 1),
	"fat_g_max" numeric(6, 1),
	"fibre_g_min" numeric(6, 1),
	"fibre_g_max" numeric(6, 1),
	"fluid_note" text,
	"rationale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nutrition_target_kcal" CHECK ("nutrition_target"."kcal_min" > 0 and "nutrition_target"."kcal_min" <= "nutrition_target"."kcal_max"),
	CONSTRAINT "nutrition_target_protein_range" CHECK (("nutrition_target"."protein_g_min" is null and "nutrition_target"."protein_g_max" is null) or ("nutrition_target"."protein_g_min" is not null and "nutrition_target"."protein_g_max" is not null and "nutrition_target"."protein_g_min" >= 0 and "nutrition_target"."protein_g_max" > 0 and "nutrition_target"."protein_g_min" <= "nutrition_target"."protein_g_max")),
	CONSTRAINT "nutrition_target_carbs_range" CHECK (("nutrition_target"."carbs_g_min" is null and "nutrition_target"."carbs_g_max" is null) or ("nutrition_target"."carbs_g_min" is not null and "nutrition_target"."carbs_g_max" is not null and "nutrition_target"."carbs_g_min" >= 0 and "nutrition_target"."carbs_g_max" > 0 and "nutrition_target"."carbs_g_min" <= "nutrition_target"."carbs_g_max")),
	CONSTRAINT "nutrition_target_fat_range" CHECK (("nutrition_target"."fat_g_min" is null and "nutrition_target"."fat_g_max" is null) or ("nutrition_target"."fat_g_min" is not null and "nutrition_target"."fat_g_max" is not null and "nutrition_target"."fat_g_min" >= 0 and "nutrition_target"."fat_g_max" > 0 and "nutrition_target"."fat_g_min" <= "nutrition_target"."fat_g_max")),
	CONSTRAINT "nutrition_target_fibre_range" CHECK (("nutrition_target"."fibre_g_min" is null and "nutrition_target"."fibre_g_max" is null) or ("nutrition_target"."fibre_g_min" is not null and "nutrition_target"."fibre_g_max" is not null and "nutrition_target"."fibre_g_min" >= 0 and "nutrition_target"."fibre_g_max" > 0 and "nutrition_target"."fibre_g_min" <= "nutrition_target"."fibre_g_max"))
);
--> statement-breakpoint
CREATE TABLE "planned_meal" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"meal_plan_day_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"type" "meal_type" NOT NULL,
	"time" time,
	"name" text NOT NULL,
	"prep" text,
	"substitutions" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planned_meal_position" CHECK ("planned_meal"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "planned_meal_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"planned_meal_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"food_revision_id" uuid NOT NULL,
	"grams" numeric(7, 1) NOT NULL,
	"household" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planned_meal_item_position" CHECK ("planned_meal_item"."position" >= 0),
	CONSTRAINT "planned_meal_item_grams" CHECK ("planned_meal_item"."grams" > 0 and "planned_meal_item"."grams" <= 5000)
);
--> statement-breakpoint
CREATE TABLE "checklist_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"team_id" uuid,
	"athlete_id" uuid,
	"race_entry_id" uuid,
	"title" text NOT NULL,
	"category" "checklist_category" NOT NULL,
	"due_date" date,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone,
	"done_by_athlete_id" uuid,
	"is_private" boolean DEFAULT false NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checklist_item_one_owner" CHECK (num_nonnulls("checklist_item"."team_id", "checklist_item"."athlete_id") = 1),
	CONSTRAINT "checklist_item_private_individual_only" CHECK (not "checklist_item"."is_private" or "checklist_item"."athlete_id" is not null),
	CONSTRAINT "checklist_item_done_at" CHECK ("checklist_item"."done" = ("checklist_item"."done_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "daily_checkin" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"date" date NOT NULL,
	"sleep_hours" numeric(3, 1),
	"bed_time" time,
	"wake_time" time,
	"sleep_quality" smallint,
	"soreness" smallint,
	"soreness_areas" text[] DEFAULT '{}' NOT NULL,
	"energy" smallint,
	"fluid_l" numeric(4, 2),
	"body_weight_kg" numeric(5, 2),
	"resting_hr" smallint,
	"red_flags" "red_flag"[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_checkin_sleep_hours" CHECK ("daily_checkin"."sleep_hours" between 0 and 24),
	CONSTRAINT "daily_checkin_sleep_quality" CHECK ("daily_checkin"."sleep_quality" between 1 and 5),
	CONSTRAINT "daily_checkin_soreness" CHECK ("daily_checkin"."soreness" between 1 and 10),
	CONSTRAINT "daily_checkin_energy" CHECK ("daily_checkin"."energy" between 1 and 5),
	CONSTRAINT "daily_checkin_fluid" CHECK ("daily_checkin"."fluid_l" between 0 and 15),
	CONSTRAINT "daily_checkin_body_weight" CHECK ("daily_checkin"."body_weight_kg" between 30 and 250),
	CONSTRAINT "daily_checkin_resting_hr" CHECK ("daily_checkin"."resting_hr" between 25 and 220)
);
--> statement-breakpoint
CREATE TABLE "station_split" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"race_entry_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"plan_text" text,
	"notes" text,
	"updated_by_athlete_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_profile" ADD CONSTRAINT "athlete_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_response" ADD CONSTRAINT "onboarding_response_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sharing_setting" ADD CONSTRAINT "sharing_setting_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_created_by_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("created_by_athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_created_by_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("created_by_athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_accepted_by_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("accepted_by_athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_category" ADD CONSTRAINT "event_category_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_event_category_id_event_category_id_fk" FOREIGN KEY ("event_category_id") REFERENCES "public"."event_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_entry" ADD CONSTRAINT "race_entry_event_category_id_event_category_id_fk" FOREIGN KEY ("event_category_id") REFERENCES "public"."event_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_entry" ADD CONSTRAINT "race_entry_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_entry" ADD CONSTRAINT "race_entry_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_note" ADD CONSTRAINT "rule_note_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_note" ADD CONSTRAINT "rule_note_event_category_id_event_category_id_fk" FOREIGN KEY ("event_category_id") REFERENCES "public"."event_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_note" ADD CONSTRAINT "rule_note_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station" ADD CONSTRAINT "station_event_category_id_event_category_id_fk" FOREIGN KEY ("event_category_id") REFERENCES "public"."event_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_owner_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("owner_athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_owner_team_id_team_id_fk" FOREIGN KEY ("owner_team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_event_category_id_event_category_id_fk" FOREIGN KEY ("event_category_id") REFERENCES "public"."event_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_created_by_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("created_by_athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_import" ADD CONSTRAINT "plan_import_imported_by_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("imported_by_athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_import_id_plan_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."plan_import"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_created_by_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("created_by_athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_approved_by_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("approved_by_athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version_athlete" ADD CONSTRAINT "plan_version_athlete_plan_version_id_plan_version_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version_athlete" ADD CONSTRAINT "plan_version_athlete_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark" ADD CONSTRAINT "benchmark_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark" ADD CONSTRAINT "benchmark_benchmark_type_id_benchmark_type_id_fk" FOREIGN KEY ("benchmark_type_id") REFERENCES "public"."benchmark_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark_type" ADD CONSTRAINT "benchmark_type_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark_type" ADD CONSTRAINT "benchmark_type_event_category_id_event_category_id_fk" FOREIGN KEY ("event_category_id") REFERENCES "public"."event_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark_type" ADD CONSTRAINT "benchmark_type_owner_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("owner_athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_prescription" ADD CONSTRAINT "exercise_prescription_block_id_session_block_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."session_block"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_prescription" ADD CONSTRAINT "exercise_prescription_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_athlete" ADD CONSTRAINT "session_athlete_session_id_training_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_athlete" ADD CONSTRAINT "session_athlete_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_block" ADD CONSTRAINT "session_block_session_id_training_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_log" ADD CONSTRAINT "set_log_workout_log_id_workout_log_id_fk" FOREIGN KEY ("workout_log_id") REFERENCES "public"."workout_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_log" ADD CONSTRAINT "set_log_prescription_id_exercise_prescription_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."exercise_prescription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_plan_version_id_plan_version_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_log" ADD CONSTRAINT "workout_log_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_log" ADD CONSTRAINT "workout_log_session_id_training_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_rule" ADD CONSTRAINT "diet_rule_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_price" ADD CONSTRAINT "food_price_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_price" ADD CONSTRAINT "food_price_import_id_plan_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."plan_import"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_revision" ADD CONSTRAINT "food_revision_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_revision" ADD CONSTRAINT "food_revision_created_by_import_id_plan_import_id_fk" FOREIGN KEY ("created_by_import_id") REFERENCES "public"."plan_import"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_log" ADD CONSTRAINT "meal_log_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_log" ADD CONSTRAINT "meal_log_planned_meal_id_planned_meal_id_fk" FOREIGN KEY ("planned_meal_id") REFERENCES "public"."planned_meal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_log_item" ADD CONSTRAINT "meal_log_item_meal_log_id_meal_log_id_fk" FOREIGN KEY ("meal_log_id") REFERENCES "public"."meal_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_log_item" ADD CONSTRAINT "meal_log_item_food_revision_id_food_revision_id_fk" FOREIGN KEY ("food_revision_id") REFERENCES "public"."food_revision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_log_item" ADD CONSTRAINT "meal_log_item_planned_item_id_planned_meal_item_id_fk" FOREIGN KEY ("planned_item_id") REFERENCES "public"."planned_meal_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_day" ADD CONSTRAINT "meal_plan_day_plan_version_id_plan_version_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_day" ADD CONSTRAINT "meal_plan_day_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_target" ADD CONSTRAINT "nutrition_target_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_target" ADD CONSTRAINT "nutrition_target_plan_version_id_plan_version_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_meal" ADD CONSTRAINT "planned_meal_meal_plan_day_id_meal_plan_day_id_fk" FOREIGN KEY ("meal_plan_day_id") REFERENCES "public"."meal_plan_day"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_meal_item" ADD CONSTRAINT "planned_meal_item_planned_meal_id_planned_meal_id_fk" FOREIGN KEY ("planned_meal_id") REFERENCES "public"."planned_meal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_meal_item" ADD CONSTRAINT "planned_meal_item_food_revision_id_food_revision_id_fk" FOREIGN KEY ("food_revision_id") REFERENCES "public"."food_revision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_race_entry_id_race_entry_id_fk" FOREIGN KEY ("race_entry_id") REFERENCES "public"."race_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_done_by_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("done_by_athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_checkin" ADD CONSTRAINT "daily_checkin_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_split" ADD CONSTRAINT "station_split_race_entry_id_race_entry_id_fk" FOREIGN KEY ("race_entry_id") REFERENCES "public"."race_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_split" ADD CONSTRAINT "station_split_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_split" ADD CONSTRAINT "station_split_updated_by_athlete_id_athlete_profile_id_fk" FOREIGN KEY ("updated_by_athlete_id") REFERENCES "public"."athlete_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_response_section_unique" ON "onboarding_response" USING btree ("athlete_id","question_set_key","question_set_version","section");--> statement-breakpoint
CREATE INDEX "team_created_by_idx" ON "team" USING btree ("created_by_athlete_id");--> statement-breakpoint
CREATE INDEX "team_invite_team_idx" ON "team_invite" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_invite_created_by_idx" ON "team_invite" USING btree ("created_by_athlete_id");--> statement-breakpoint
CREATE INDEX "team_invite_accepted_by_idx" ON "team_invite" USING btree ("accepted_by_athlete_id");--> statement-breakpoint
CREATE INDEX "team_member_athlete_idx" ON "team_member" USING btree ("athlete_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_category_event_key_unique" ON "event_category" USING btree ("event_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_active_athlete_unique" ON "goal" USING btree ("athlete_id","event_category_id") WHERE "goal"."is_active";--> statement-breakpoint
CREATE UNIQUE INDEX "goal_active_team_unique" ON "goal" USING btree ("team_id","event_category_id") WHERE "goal"."is_active";--> statement-breakpoint
CREATE INDEX "goal_category_idx" ON "goal" USING btree ("event_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "race_entry_team_unique" ON "race_entry" USING btree ("team_id","event_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "race_entry_athlete_unique" ON "race_entry" USING btree ("athlete_id","event_category_id");--> statement-breakpoint
CREATE INDEX "race_entry_category_idx" ON "race_entry" USING btree ("event_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rule_note_event_key_unique" ON "rule_note" USING btree ("event_id","key");--> statement-breakpoint
CREATE INDEX "rule_note_category_idx" ON "rule_note" USING btree ("event_category_id");--> statement-breakpoint
CREATE INDEX "rule_note_station_idx" ON "rule_note" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "station_category_key_unique" ON "station" USING btree ("event_category_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "station_category_position_unique" ON "station" USING btree ("event_category_id","position");--> statement-breakpoint
CREATE INDEX "plan_owner_athlete_idx" ON "plan" USING btree ("owner_athlete_id");--> statement-breakpoint
CREATE INDEX "plan_owner_team_idx" ON "plan" USING btree ("owner_team_id");--> statement-breakpoint
CREATE INDEX "plan_category_idx" ON "plan" USING btree ("event_category_id");--> statement-breakpoint
CREATE INDEX "plan_created_by_idx" ON "plan" USING btree ("created_by_athlete_id");--> statement-breakpoint
CREATE INDEX "plan_import_importer_recent_idx" ON "plan_import" USING btree ("imported_by_athlete_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "plan_import_sha256_idx" ON "plan_import" USING btree ("sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_version_number_unique" ON "plan_version" USING btree ("plan_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_version_one_approved" ON "plan_version" USING btree ("plan_id") WHERE "plan_version"."status" = 'approved';--> statement-breakpoint
CREATE INDEX "plan_version_status_dates_idx" ON "plan_version" USING btree ("status","start_date","end_date");--> statement-breakpoint
CREATE INDEX "plan_version_created_by_idx" ON "plan_version" USING btree ("created_by_athlete_id");--> statement-breakpoint
CREATE INDEX "plan_version_approved_by_idx" ON "plan_version" USING btree ("approved_by_athlete_id");--> statement-breakpoint
CREATE INDEX "plan_version_athlete_athlete_idx" ON "plan_version_athlete" USING btree ("athlete_id");--> statement-breakpoint
CREATE INDEX "benchmark_athlete_type_date_idx" ON "benchmark" USING btree ("athlete_id","benchmark_type_id","date");--> statement-breakpoint
CREATE INDEX "benchmark_type_idx" ON "benchmark" USING btree ("benchmark_type_id");--> statement-breakpoint
CREATE INDEX "benchmark_type_station_idx" ON "benchmark_type" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "benchmark_type_category_idx" ON "benchmark_type" USING btree ("event_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_prescription_position_unique" ON "exercise_prescription" USING btree ("block_id","position");--> statement-breakpoint
CREATE INDEX "exercise_prescription_station_idx" ON "exercise_prescription" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "session_athlete_athlete_idx" ON "session_athlete" USING btree ("athlete_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_block_position_unique" ON "session_block" USING btree ("session_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "set_log_position_unique" ON "set_log" USING btree ("workout_log_id","exercise_position","set_number");--> statement-breakpoint
CREATE INDEX "set_log_prescription_idx" ON "set_log" USING btree ("prescription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_session_day_position_unique" ON "training_session" USING btree ("plan_version_id","date","position");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_log_session_unique" ON "workout_log" USING btree ("athlete_id","session_id");--> statement-breakpoint
CREATE INDEX "workout_log_athlete_date_idx" ON "workout_log" USING btree ("athlete_id","date");--> statement-breakpoint
CREATE INDEX "workout_log_session_idx" ON "workout_log" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "diet_rule_athlete_idx" ON "diet_rule" USING btree ("athlete_id");--> statement-breakpoint
CREATE UNIQUE INDEX "food_price_food_date_source_unique" ON "food_price" USING btree ("food_id","as_of","source");--> statement-breakpoint
CREATE INDEX "food_price_import_idx" ON "food_price" USING btree ("import_id");--> statement-breakpoint
CREATE UNIQUE INDEX "food_revision_number_unique" ON "food_revision" USING btree ("food_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "food_revision_content_unique" ON "food_revision" USING btree ("food_id","content_hash");--> statement-breakpoint
CREATE INDEX "food_revision_import_idx" ON "food_revision" USING btree ("created_by_import_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_log_planned_unique" ON "meal_log" USING btree ("athlete_id","planned_meal_id");--> statement-breakpoint
CREATE INDEX "meal_log_athlete_date_idx" ON "meal_log" USING btree ("athlete_id","date");--> statement-breakpoint
CREATE INDEX "meal_log_planned_idx" ON "meal_log" USING btree ("planned_meal_id");--> statement-breakpoint
CREATE INDEX "meal_log_item_log_idx" ON "meal_log_item" USING btree ("meal_log_id");--> statement-breakpoint
CREATE INDEX "meal_log_item_food_idx" ON "meal_log_item" USING btree ("food_revision_id");--> statement-breakpoint
CREATE INDEX "meal_log_item_planned_idx" ON "meal_log_item" USING btree ("planned_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_plan_day_date_unique" ON "meal_plan_day" USING btree ("plan_version_id","date");--> statement-breakpoint
CREATE INDEX "meal_plan_day_athlete_date_idx" ON "meal_plan_day" USING btree ("athlete_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "nutrition_target_version_unique" ON "nutrition_target" USING btree ("plan_version_id");--> statement-breakpoint
CREATE INDEX "nutrition_target_athlete_from_idx" ON "nutrition_target" USING btree ("athlete_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "planned_meal_position_unique" ON "planned_meal" USING btree ("meal_plan_day_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "planned_meal_item_position_unique" ON "planned_meal_item" USING btree ("planned_meal_id","position");--> statement-breakpoint
CREATE INDEX "planned_meal_item_food_idx" ON "planned_meal_item" USING btree ("food_revision_id");--> statement-breakpoint
CREATE INDEX "checklist_item_team_idx" ON "checklist_item" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "checklist_item_athlete_idx" ON "checklist_item" USING btree ("athlete_id");--> statement-breakpoint
CREATE INDEX "checklist_item_race_entry_idx" ON "checklist_item" USING btree ("race_entry_id");--> statement-breakpoint
CREATE INDEX "checklist_item_done_by_idx" ON "checklist_item" USING btree ("done_by_athlete_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_checkin_athlete_date_unique" ON "daily_checkin" USING btree ("athlete_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "station_split_entry_station_unique" ON "station_split" USING btree ("race_entry_id","station_id");--> statement-breakpoint
CREATE INDEX "station_split_station_idx" ON "station_split" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "station_split_updated_by_idx" ON "station_split" USING btree ("updated_by_athlete_id");