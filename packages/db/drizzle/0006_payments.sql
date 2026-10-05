CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"case_id" uuid,
	"case_label" text NOT NULL,
	"kind" text NOT NULL,
	"amount_inr" integer NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"note" text,
	"recorded_by_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "fee_status" text DEFAULT 'not_set' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "fee_amount_inr" integer;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "fee_note" text;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;