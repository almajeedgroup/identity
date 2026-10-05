CREATE TABLE "target_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"field" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "target_changes" ADD CONSTRAINT "target_changes_profile_id_citizen_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."citizen_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "target_changes_profile" ON "target_changes" USING btree ("profile_id","created_at");