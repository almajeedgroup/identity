ALTER TABLE "kb_items" ADD COLUMN "published_by_id" uuid;--> statement-breakpoint
ALTER TABLE "kb_items" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kb_items" ADD COLUMN "verified_on" text;--> statement-breakpoint
ALTER TABLE "kb_items" ADD COLUMN "verified_by_id" uuid;--> statement-breakpoint
ALTER TABLE "kb_items" ADD COLUMN "verified_source" text;--> statement-breakpoint
ALTER TABLE "kb_items" ADD COLUMN "verified_at" timestamp with time zone;