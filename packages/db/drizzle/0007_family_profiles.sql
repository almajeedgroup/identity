ALTER TABLE "citizen_profiles" ADD COLUMN "parent_role" text;--> statement-breakpoint
ALTER TABLE "citizen_profiles" ADD COLUMN "consent_basis" text;--> statement-breakpoint
ALTER TABLE "citizen_profiles" ADD COLUMN "declared_at" timestamp with time zone;