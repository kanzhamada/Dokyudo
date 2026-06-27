-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Create a function to trigger a webhook to the STB Worker
CREATE OR REPLACE FUNCTION notify_document_uploaded()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    PERFORM net.http_post(
        url := 'https://worker.dokyudo.my.id/api/ingest', -- TODO: Adjust if STB Worker URL is different
        body := jsonb_build_object(
            'document_id', NEW.id,
            'tenant_id', NEW.tenant_id
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to allow safe reruns
DROP TRIGGER IF EXISTS document_uploaded_trigger ON documents;

-- Attach the trigger to the documents table
CREATE TRIGGER document_uploaded_trigger
AFTER UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION notify_document_uploaded();