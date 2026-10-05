-- C-16 · Original document values are immutable.
CREATE OR REPLACE FUNCTION identity_original_is_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.original IS DISTINCT FROM OLD.original THEN
    RAISE EXCEPTION 'document_fields.original is immutable (C-16)' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER document_fields_original_immutable BEFORE UPDATE ON document_fields FOR EACH ROW EXECUTE FUNCTION identity_original_is_immutable();
--> statement-breakpoint
-- M15-FR-05 · The audit log is append-only.
CREATE OR REPLACE FUNCTION identity_audit_is_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (M15)' USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION identity_audit_is_append_only();
