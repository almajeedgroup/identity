CREATE TABLE "case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"from_state" text,
	"to_state" text,
	"actor_kind" text NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"citizen_visible" boolean DEFAULT true NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"kind" text NOT NULL,
	"label" text,
	"uploaded_by_kind" text NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purge_after" timestamp with time zone,
	"purged_at" timestamp with time zone,
	CONSTRAINT "case_files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "case_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"visibility" text NOT NULL,
	"body" text NOT NULL,
	"author_kind" text NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"done_at" timestamp with time zone,
	"done_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"document_id" uuid,
	"document_kind" text NOT NULL,
	"applicant_name" text,
	"issues" jsonb NOT NULL,
	"rule" jsonb,
	"government_fees" jsonb NOT NULL,
	"service_fee" jsonb,
	"help_mode" text NOT NULL,
	"priority" jsonb NOT NULL,
	"deadline" text,
	"deadline_note" text,
	"state" text DEFAULT 'new' NOT NULL,
	"closure_reason" text,
	"assigned_to_id" uuid,
	"application_ref" text,
	"application_date" text,
	"appointment_at" timestamp with time zone,
	"next_action" text,
	"next_action_due" text,
	"completed_at" timestamp with time zone,
	"completion_note" text,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cases_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_tasks" ADD CONSTRAINT "case_tasks_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_profile_id_citizen_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."citizen_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_to_id_staff_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_events_case" ON "case_events" USING btree ("case_id","at");--> statement-breakpoint
CREATE INDEX "cases_user" ON "cases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cases_state" ON "cases" USING btree ("state");--> statement-breakpoint
CREATE INDEX "cases_assigned" ON "cases" USING btree ("assigned_to_id");