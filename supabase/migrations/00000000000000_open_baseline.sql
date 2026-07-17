-- VisaWorker open-source schema baseline (public schema).
-- Generated from the production schema with enterprise-only tables/functions
-- stripped per docs/oss/ee-db-manifest.json. Apply against a fresh Supabase
-- project (which already provides the auth schema, roles, and extensions).

-- Tables

CREATE TABLE public.compile_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  status text DEFAULT 'queued'::text NOT NULL,
  reason text,
  request_compile_tool_use_id text,
  pending_tool_results jsonb,
  log text,
  pdf_path text,
  error_lines jsonb,
  requested_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone
);

CREATE TABLE public.document_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  tool_use_id text NOT NULL,
  title text,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  handled_at timestamp with time zone
);

CREATE TABLE public.exhibit_cache (
  exhibit_id uuid NOT NULL,
  extracted_text text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.exhibits (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  order_index integer DEFAULT 0 NOT NULL,
  label text NOT NULL,
  title text DEFAULT ''::text NOT NULL,
  storage_path text,
  page_count integer,
  size_bytes bigint,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  tags text[] DEFAULT '{}'::text[] NOT NULL,
  mime_type text DEFAULT 'application/pdf'::text NOT NULL,
  original_filename text,
  original_storage_path text,
  original_page_count integer,
  included_pages integer[],
  ai_recommendation jsonb,
  review_status text DEFAULT 'skipped'::text NOT NULL,
  trimmed_at timestamp with time zone
);

CREATE TABLE public.letter_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  letter_id uuid NOT NULL,
  type text NOT NULL,
  actor text DEFAULT 'user'::text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.letter_tokens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  letter_id uuid NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.letters (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  recommender_name text DEFAULT ''::text NOT NULL,
  recommender_email text DEFAULT ''::text NOT NULL,
  recommender_title text DEFAULT ''::text NOT NULL,
  recommender_org text DEFAULT ''::text NOT NULL,
  relationship text DEFAULT ''::text NOT NULL,
  notes text DEFAULT ''::text NOT NULL,
  subject text DEFAULT ''::text NOT NULL,
  body_md text DEFAULT ''::text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  exhibit_id uuid,
  signed_at timestamp with time zone,
  signed_name text,
  signature_image_path text,
  signer_ip_hash text,
  signer_user_agent text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  signature_data_url text
);

CREATE TABLE public.messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  role text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.profiles (
  user_id uuid NOT NULL,
  display_name text,
  bypass_billing boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  onboarded_at timestamp with time zone,
  credit_cents integer DEFAULT 0 NOT NULL,
  paid_referral_count integer DEFAULT 0 NOT NULL,
  stripe_connect_account_id text,
  marketing_opt_out boolean DEFAULT false NOT NULL,
  unsubscribe_token text
);

CREATE TABLE public.project_billing (
  project_id uuid NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  amount_cents integer,
  currency text DEFAULT 'usd'::text NOT NULL,
  paid_at timestamp with time zone,
  token_budget bigint DEFAULT 10000000 NOT NULL,
  tokens_used bigint DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  free_messages_used integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.projects (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  visa_type text NOT NULL,
  beneficiary_name text,
  field text,
  theme jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  profile_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  strategy_md text DEFAULT ''::text NOT NULL,
  editor_mode text DEFAULT 'editing'::text NOT NULL,
  ai_mode text DEFAULT 'managed'::text NOT NULL,
  byok_provider text,
  byok_key_ciphertext text,
  byok_key_last4 text,
  byok_verified_at timestamp with time zone,
  ref_code text,
  ref_locked_at timestamp with time zone
);

CREATE TABLE public.section_suggestions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  section_id uuid NOT NULL,
  project_id uuid NOT NULL,
  base_version_id uuid,
  author_user_id uuid NOT NULL,
  author_role text DEFAULT 'owner'::text NOT NULL,
  hunks jsonb DEFAULT '[]'::jsonb NOT NULL,
  summary text,
  status text DEFAULT 'draft'::text NOT NULL,
  resolved_by_user_id uuid,
  resolved_at timestamp with time zone,
  resolution_note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.section_versions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  section_id uuid NOT NULL,
  project_id uuid NOT NULL,
  version_number integer NOT NULL,
  tex_body text NOT NULL,
  parent_version_id uuid,
  author_user_id uuid,
  author_role text DEFAULT 'owner'::text NOT NULL,
  source text DEFAULT 'manual_edit'::text NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sections (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  order_index integer DEFAULT 0 NOT NULL,
  section_key text NOT NULL,
  title text DEFAULT ''::text NOT NULL,
  tex_body text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by_source text
);

CREATE TABLE public.suggestion_comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  suggestion_id uuid NOT NULL,
  project_id uuid NOT NULL,
  author_user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.uploads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  kind text DEFAULT 'other'::text NOT NULL,
  title text NOT NULL,
  storage_path text,
  extracted_text text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  mime_type text DEFAULT 'application/octet-stream'::text NOT NULL,
  size_bytes integer,
  request_id uuid,
  slot_key text
);

-- Constraints

ALTER TABLE public.compile_requests ADD CONSTRAINT compile_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.document_requests ADD CONSTRAINT document_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.document_requests ADD CONSTRAINT document_requests_tool_use_id_key UNIQUE (tool_use_id);
ALTER TABLE public.exhibit_cache ADD CONSTRAINT exhibit_cache_pkey PRIMARY KEY (exhibit_id);
ALTER TABLE public.exhibits ADD CONSTRAINT exhibits_pkey PRIMARY KEY (id);
ALTER TABLE public.exhibits ADD CONSTRAINT exhibits_project_id_label_key UNIQUE (project_id, label);
ALTER TABLE public.exhibits ADD CONSTRAINT exhibits_review_status_check CHECK ((review_status = ANY (ARRAY['skipped'::text, 'auto_applied'::text, 'needs_attention'::text, 'user_confirmed'::text, 'capped'::text, 'pending'::text, 'rejected'::text])));
ALTER TABLE public.letter_events ADD CONSTRAINT letter_events_actor_check CHECK ((actor = ANY (ARRAY['agent'::text, 'user'::text, 'recommender'::text, 'system'::text])));
ALTER TABLE public.letter_events ADD CONSTRAINT letter_events_pkey PRIMARY KEY (id);
ALTER TABLE public.letter_events ADD CONSTRAINT letter_events_type_check CHECK ((type = ANY (ARRAY['drafted'::text, 'edited'::text, 'sent'::text, 'viewed'::text, 'commented'::text, 'signed'::text, 'revoked'::text, 'superseded'::text])));
ALTER TABLE public.letter_tokens ADD CONSTRAINT letter_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.letter_tokens ADD CONSTRAINT letter_tokens_token_key UNIQUE (token);
ALTER TABLE public.letters ADD CONSTRAINT letters_pkey PRIMARY KEY (id);
ALTER TABLE public.letters ADD CONSTRAINT letters_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'awaiting_review'::text, 'changes_requested'::text, 'signed'::text, 'superseded'::text])));
ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE public.messages ADD CONSTRAINT messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'tool'::text])));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_unsubscribe_token_key UNIQUE (unsubscribe_token);
ALTER TABLE public.project_billing ADD CONSTRAINT project_billing_pkey PRIMARY KEY (project_id);
ALTER TABLE public.project_billing ADD CONSTRAINT project_billing_stripe_checkout_session_id_key UNIQUE (stripe_checkout_session_id);
ALTER TABLE public.projects ADD CONSTRAINT projects_ai_mode_check CHECK ((ai_mode = ANY (ARRAY['managed'::text, 'byok'::text])));
ALTER TABLE public.projects ADD CONSTRAINT projects_editor_mode_check CHECK ((editor_mode = ANY (ARRAY['editing'::text, 'suggesting'::text])));
ALTER TABLE public.projects ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
ALTER TABLE public.projects ADD CONSTRAINT projects_visa_type_check CHECK ((visa_type = ANY (ARRAY['O-1A'::text, 'EB-1A'::text, 'NIW'::text])));
ALTER TABLE public.section_suggestions ADD CONSTRAINT section_suggestions_author_role_check CHECK ((author_role = ANY (ARRAY['owner'::text, 'collaborator'::text, 'agent'::text])));
ALTER TABLE public.section_suggestions ADD CONSTRAINT section_suggestions_pkey PRIMARY KEY (id);
ALTER TABLE public.section_suggestions ADD CONSTRAINT section_suggestions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'accepted'::text, 'rejected'::text, 'superseded'::text, 'conflicted'::text])));
ALTER TABLE public.section_versions ADD CONSTRAINT section_versions_author_role_check CHECK ((author_role = ANY (ARRAY['owner'::text, 'collaborator'::text, 'agent'::text, 'system'::text])));
ALTER TABLE public.section_versions ADD CONSTRAINT section_versions_pkey PRIMARY KEY (id);
ALTER TABLE public.section_versions ADD CONSTRAINT section_versions_section_id_version_number_key UNIQUE (section_id, version_number);
ALTER TABLE public.section_versions ADD CONSTRAINT section_versions_source_check CHECK ((source = ANY (ARRAY['manual_edit'::text, 'suggestion_accept'::text, 'agent_turn'::text, 'restore'::text, 'import'::text])));
ALTER TABLE public.sections ADD CONSTRAINT sections_pkey PRIMARY KEY (id);
ALTER TABLE public.sections ADD CONSTRAINT sections_project_id_section_key_key UNIQUE (project_id, section_key);
ALTER TABLE public.suggestion_comments ADD CONSTRAINT suggestion_comments_pkey PRIMARY KEY (id);
ALTER TABLE public.uploads ADD CONSTRAINT uploads_pkey PRIMARY KEY (id);
ALTER TABLE public.compile_requests ADD CONSTRAINT compile_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.document_requests ADD CONSTRAINT document_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.exhibit_cache ADD CONSTRAINT exhibit_cache_exhibit_id_fkey FOREIGN KEY (exhibit_id) REFERENCES exhibits(id) ON DELETE CASCADE;
ALTER TABLE public.exhibits ADD CONSTRAINT exhibits_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.letter_events ADD CONSTRAINT letter_events_letter_id_fkey FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE CASCADE;
ALTER TABLE public.letter_tokens ADD CONSTRAINT letter_tokens_letter_id_fkey FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE CASCADE;
ALTER TABLE public.letters ADD CONSTRAINT letters_exhibit_id_fkey FOREIGN KEY (exhibit_id) REFERENCES exhibits(id) ON DELETE SET NULL;
ALTER TABLE public.letters ADD CONSTRAINT letters_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.project_billing ADD CONSTRAINT project_billing_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.section_suggestions ADD CONSTRAINT section_suggestions_base_version_id_fkey FOREIGN KEY (base_version_id) REFERENCES section_versions(id) ON DELETE SET NULL;
ALTER TABLE public.section_suggestions ADD CONSTRAINT section_suggestions_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.section_suggestions ADD CONSTRAINT section_suggestions_section_id_fkey FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;
ALTER TABLE public.section_versions ADD CONSTRAINT section_versions_parent_version_id_fkey FOREIGN KEY (parent_version_id) REFERENCES section_versions(id) ON DELETE SET NULL;
ALTER TABLE public.section_versions ADD CONSTRAINT section_versions_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.section_versions ADD CONSTRAINT section_versions_section_id_fkey FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;
ALTER TABLE public.sections ADD CONSTRAINT sections_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.suggestion_comments ADD CONSTRAINT suggestion_comments_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.suggestion_comments ADD CONSTRAINT suggestion_comments_suggestion_id_fkey FOREIGN KEY (suggestion_id) REFERENCES section_suggestions(id) ON DELETE CASCADE;
ALTER TABLE public.uploads ADD CONSTRAINT uploads_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.uploads ADD CONSTRAINT uploads_request_id_fkey FOREIGN KEY (request_id) REFERENCES document_requests(id) ON DELETE SET NULL;

-- Indexes

CREATE INDEX compile_requests_project_status_idx ON public.compile_requests USING btree (project_id, status, requested_at);
CREATE INDEX document_requests_project_idx ON public.document_requests USING btree (project_id, created_at);
CREATE INDEX exhibits_project_order_idx ON public.exhibits USING btree (project_id, order_index);
CREATE INDEX letter_events_letter_id_idx ON public.letter_events USING btree (letter_id, created_at DESC);
CREATE INDEX letter_tokens_letter_id_idx ON public.letter_tokens USING btree (letter_id);
CREATE INDEX letters_project_id_idx ON public.letters USING btree (project_id);
CREATE INDEX messages_project_created_idx ON public.messages USING btree (project_id, created_at);
CREATE UNIQUE INDEX section_suggestions_one_draft_per_author ON public.section_suggestions USING btree (section_id, author_user_id) WHERE (status = 'draft'::text);
CREATE INDEX section_suggestions_project_idx ON public.section_suggestions USING btree (project_id);
CREATE INDEX section_suggestions_section_status_idx ON public.section_suggestions USING btree (section_id, status);
CREATE INDEX section_versions_section_idx ON public.section_versions USING btree (section_id, version_number DESC);
CREATE INDEX section_versions_project_idx ON public.section_versions USING btree (project_id);
CREATE INDEX sections_project_order_idx ON public.sections USING btree (project_id, order_index);
CREATE INDEX suggestion_comments_suggestion_idx ON public.suggestion_comments USING btree (suggestion_id, created_at);
CREATE INDEX uploads_request_idx ON public.uploads USING btree (request_id);
CREATE INDEX uploads_project_idx ON public.uploads USING btree (project_id);

-- Functions

CREATE OR REPLACE FUNCTION public.consume_case_tokens(_project_id uuid, _in bigint, _out bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_used bigint;
  budget bigint;
  in_amt bigint := GREATEST(COALESCE(_in, 0), 0);
  out_amt bigint := GREATEST(COALESCE(_out, 0), 0);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                        OR (current_user = 'service_role');
BEGIN
  -- Defense in depth: block direct calls from end-users. Metering is only
  -- ever invoked by the trusted server via the service-role client.
  IF NOT is_service THEN
    IF auth.uid() IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.owner_id = auth.uid()) THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
  END IF;

  UPDATE public.project_billing
  SET tokens_used = tokens_used + in_amt + out_amt,
      updated_at = now()
  WHERE project_id = _project_id
  RETURNING tokens_used, token_budget INTO new_used, budget;

  IF new_used IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN GREATEST(budget - new_used, 0);
END $function$
;


CREATE OR REPLACE FUNCTION public.create_free_project(_name text, _visa_type text, _beneficiary_name text DEFAULT NULL::text, _field text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  new_project_id uuid;
  existing_free_count int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- One free case cap
  SELECT COUNT(*) INTO existing_free_count
    FROM public.project_billing pb
    JOIN public.projects p ON p.id = pb.project_id
   WHERE p.owner_id = uid AND pb.status = 'free';
  IF existing_free_count > 0 THEN
    RAISE EXCEPTION 'free_case_already_exists';
  END IF;

  INSERT INTO public.projects (owner_id, name, visa_type, beneficiary_name, field)
  VALUES (uid, _name, _visa_type, _beneficiary_name, _field)
  RETURNING id INTO new_project_id;

  INSERT INTO public.project_billing (project_id, status, token_budget, tokens_used, free_messages_used)
  VALUES (new_project_id, 'free', 500000, 0, 0);

  RETURN new_project_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, unsubscribe_token)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    encode(extensions.gen_random_bytes(18), 'hex')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.increment_free_message(_project_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                        OR (current_user = 'service_role');
  new_count int;
BEGIN
  IF NOT is_service THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE public.project_billing
     SET free_messages_used = free_messages_used + 1,
         updated_at = now()
   WHERE project_id = _project_id AND status = 'free'
  RETURNING free_messages_used INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.letter_public_sign_pdf(_token text, _name text, _sig_data_url text, _ip_hash text, _ua text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tok public.letter_tokens%ROWTYPE;
  ltr public.letters%ROWTYPE;
  proj public.projects%ROWTYPE;
  next_idx int;
  new_label text;
  new_exhibit_id uuid;
  s_path text;
  s_at timestamptz := now();
BEGIN
  IF _name IS NULL OR btrim(_name) = '' THEN RAISE EXCEPTION 'name_required'; END IF;
  IF length(_name) > 200 THEN RAISE EXCEPTION 'name_too_long'; END IF;
  IF _sig_data_url IS NOT NULL AND length(_sig_data_url) > 700000 THEN RAISE EXCEPTION 'sig_too_large'; END IF;

  SELECT * INTO tok FROM public.letter_tokens WHERE token = _token;
  IF NOT FOUND OR tok.revoked_at IS NOT NULL OR (tok.expires_at IS NOT NULL AND tok.expires_at < now()) THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  SELECT * INTO ltr FROM public.letters WHERE id = tok.letter_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'letter_missing'; END IF;
  SELECT * INTO proj FROM public.projects WHERE id = ltr.project_id;

  UPDATE public.letters SET
    status = 'signed',
    signed_at = s_at,
    signed_name = _name,
    signature_data_url = _sig_data_url,
    signer_ip_hash = _ip_hash,
    signer_user_agent = left(COALESCE(_ua, ''), 200)
  WHERE id = ltr.id
  RETURNING * INTO ltr;

  SELECT COALESCE(MAX(order_index), 0) + 1 INTO next_idx FROM public.exhibits WHERE project_id = ltr.project_id;
  new_label := 'ex' || lpad(next_idx::text, 2, '0');
  s_path := ltr.project_id::text || '/' || new_label || '.pdf';

  INSERT INTO public.exhibits(project_id, label, title, order_index, storage_path, size_bytes, mime_type, page_count, original_filename, tags)
  VALUES (
    ltr.project_id,
    new_label,
    'Letter — ' || COALESCE(ltr.recommender_name, _name),
    next_idx,
    s_path,
    0,
    'application/pdf',
    1,
    new_label || '.pdf',
    ARRAY['letter', COALESCE(ltr.relationship, 'recommendation')]
  ) RETURNING id INTO new_exhibit_id;

  UPDATE public.letters SET exhibit_id = new_exhibit_id WHERE id = ltr.id;

  INSERT INTO public.letter_events(letter_id, type, actor, payload)
  VALUES (ltr.id, 'signed', 'recommender', jsonb_build_object('name', _name, 'exhibit_label', new_label, 'ip_hash', _ip_hash, 'ua', left(COALESCE(_ua,''), 200)));

  UPDATE public.letter_tokens SET revoked_at = s_at WHERE id = tok.id;

  RETURN jsonb_build_object(
    'ok', true,
    'exhibit_id', new_exhibit_id,
    'exhibit_label', new_label,
    'storage_path', s_path,
    'letter', jsonb_build_object(
      'id', ltr.id,
      'subject', ltr.subject,
      'body_md', ltr.body_md,
      'recommender_name', ltr.recommender_name,
      'recommender_email', ltr.recommender_email,
      'recommender_title', ltr.recommender_title,
      'recommender_org', ltr.recommender_org,
      'status', ltr.status,
      'signed_at', ltr.signed_at,
      'signed_name', ltr.signed_name,
      'signature_data_url', ltr.signature_data_url
    ),
    'project', jsonb_build_object(
      'id', proj.id,
      'name', proj.name,
      'beneficiary_name', proj.beneficiary_name,
      'visa_type', proj.visa_type
    )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.letters_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.reorder_sections(_project_id uuid, _ordered_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_owner boolean;
  i int;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.owner_id = auth.uid()
  ) INTO is_owner;
  IF NOT is_owner THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Bump into a high range first to sidestep the (project_id, order_index) uniq (if any)
  FOR i IN 1..array_length(_ordered_ids, 1) LOOP
    UPDATE public.sections
      SET order_index = 1000000 + i
      WHERE id = _ordered_ids[i] AND project_id = _project_id;
  END LOOP;

  FOR i IN 1..array_length(_ordered_ids, 1) LOOP
    UPDATE public.sections
      SET order_index = i
      WHERE id = _ordered_ids[i] AND project_id = _project_id;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_section_version(_version_id uuid, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v public.section_versions%ROWTYPE;
  is_owner boolean;
BEGIN
  SELECT * INTO v FROM public.section_versions WHERE id = _version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'version_not_found'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = v.project_id AND p.owner_id = auth.uid()) INTO is_owner;
  IF NOT is_owner THEN RAISE EXCEPTION 'not_authorized'; END IF;

  RETURN public.set_section_body(v.section_id, v.tex_body, 'restore', 'owner', coalesce(_note, 'Restored version ' || v.version_number));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sections_snapshot_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num integer;
  v_author uuid;
  v_role text;
  v_source text;
  v_note text;
  v_parent uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tex_body IS NOT DISTINCT FROM OLD.tex_body THEN
    RETURN NEW;
  END IF;

  -- Metadata is passed via GUCs set by writeSectionBody(); fall back to sensible defaults.
  BEGIN v_author := nullif(current_setting('app.version_author', true), '')::uuid; EXCEPTION WHEN others THEN v_author := NULL; END;
  v_role := coalesce(nullif(current_setting('app.version_role', true), ''), 'owner');
  v_source := coalesce(nullif(current_setting('app.version_source', true), ''), CASE WHEN TG_OP = 'INSERT' THEN 'import' ELSE 'manual_edit' END);
  v_note := nullif(current_setting('app.version_note', true), '');

  SELECT coalesce(max(version_number), 0) + 1, (SELECT id FROM public.section_versions WHERE section_id = NEW.id ORDER BY version_number DESC LIMIT 1)
    INTO next_num, v_parent
    FROM public.section_versions WHERE section_id = NEW.id;

  INSERT INTO public.section_versions(section_id, project_id, version_number, tex_body, parent_version_id, author_user_id, author_role, source, note)
  VALUES (NEW.id, NEW.project_id, next_num, NEW.tex_body, v_parent, v_author, v_role, v_source, v_note);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sections_stamp_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  src text;
BEGIN
  src := nullif(current_setting('app.version_source', true), '');
  IF src IS NULL THEN
    src := 'manual_edit';
  END IF;
  NEW.updated_by_source := src;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_section_body(_section_id uuid, _tex_body text, _source text DEFAULT 'manual_edit'::text, _role text DEFAULT 'owner'::text, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sec public.sections%ROWTYPE;
  is_owner boolean;
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                        OR (current_user = 'service_role');
  v_author uuid := auth.uid();
  new_version_id uuid;
  new_version_num integer;
BEGIN
  SELECT * INTO sec FROM public.sections WHERE id = _section_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'section_not_found'; END IF;

  IF NOT is_service THEN
    SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = sec.project_id AND p.owner_id = auth.uid()) INTO is_owner;
    IF NOT is_owner THEN RAISE EXCEPTION 'not_authorized'; END IF;
  END IF;

  IF _source NOT IN ('manual_edit','suggestion_accept','agent_turn','restore','import') THEN
    RAISE EXCEPTION 'invalid_source';
  END IF;
  IF _role NOT IN ('owner','collaborator','agent','system') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  -- Publish metadata to the trigger for this transaction.
  PERFORM set_config('app.version_author', coalesce(v_author::text, ''), true);
  PERFORM set_config('app.version_role', _role, true);
  PERFORM set_config('app.version_source', _source, true);
  PERFORM set_config('app.version_note', coalesce(_note, ''), true);

  UPDATE public.sections
    SET tex_body = _tex_body, updated_at = now()
    WHERE id = _section_id;

  SELECT id, version_number INTO new_version_id, new_version_num
    FROM public.section_versions
    WHERE section_id = _section_id
    ORDER BY version_number DESC
    LIMIT 1;

  RETURN jsonb_build_object('ok', true, 'version_id', new_version_id, 'version_number', new_version_num);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at := now(); RETURN NEW; END $function$
;

-- Triggers

CREATE TRIGGER letters_touch_updated_at BEFORE UPDATE ON public.letters FOR EACH ROW EXECUTE FUNCTION letters_touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER project_billing_touch BEFORE UPDATE ON public.project_billing FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER section_suggestions_touch BEFORE UPDATE ON public.section_suggestions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER sections_snapshot_version_trg AFTER INSERT OR UPDATE OF tex_body ON public.sections FOR EACH ROW EXECUTE FUNCTION sections_snapshot_version();
CREATE TRIGGER sections_stamp_source BEFORE INSERT OR UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION sections_stamp_source();

-- Row Level Security

ALTER TABLE public.compile_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibit_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY compile_requests_owner_all ON public.compile_requests AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = compile_requests.project_id) AND (p.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = compile_requests.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY document_requests_owner_all ON public.document_requests AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = document_requests.project_id) AND (p.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = document_requests.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY exhibit_cache_owner_all ON public.exhibit_cache AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (exhibits e
     JOIN projects p ON ((p.id = e.project_id)))
  WHERE ((e.id = exhibit_cache.exhibit_id) AND (p.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (exhibits e
     JOIN projects p ON ((p.id = e.project_id)))
  WHERE ((e.id = exhibit_cache.exhibit_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY exhibits_owner_all ON public.exhibits AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = exhibits.project_id) AND (p.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = exhibits.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Owners manage their letter events" ON public.letter_events AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (letters l
     JOIN projects p ON ((p.id = l.project_id)))
  WHERE ((l.id = letter_events.letter_id) AND (p.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (letters l
     JOIN projects p ON ((p.id = l.project_id)))
  WHERE ((l.id = letter_events.letter_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Owners manage their letter tokens" ON public.letter_tokens AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (letters l
     JOIN projects p ON ((p.id = l.project_id)))
  WHERE ((l.id = letter_tokens.letter_id) AND (p.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (letters l
     JOIN projects p ON ((p.id = l.project_id)))
  WHERE ((l.id = letter_tokens.letter_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Owners manage their letters" ON public.letters AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = letters.project_id) AND (p.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = letters.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY messages_owner_all ON public.messages AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = messages.project_id) AND (p.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = messages.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "profiles self insert" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "profiles self read" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));
CREATE POLICY "profiles self update" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "billing owner read" ON public.project_billing AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_billing.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY projects_owner_all ON public.projects AS PERMISSIVE FOR ALL TO authenticated
  USING ((owner_id = auth.uid()))
  WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "Authors can delete their draft suggestions" ON public.section_suggestions AS PERMISSIVE FOR DELETE TO authenticated
  USING (((author_user_id = auth.uid()) AND (status = ANY (ARRAY['draft'::text, 'pending'::text]))));
CREATE POLICY "Members can insert suggestions" ON public.section_suggestions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = section_suggestions.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Members can read suggestions" ON public.section_suggestions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = section_suggestions.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Members can update suggestions" ON public.section_suggestions AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = section_suggestions.project_id) AND (p.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = section_suggestions.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Members can insert section versions" ON public.section_versions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = section_versions.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Members can read section versions" ON public.section_versions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = section_versions.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY sections_owner_all ON public.sections AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = sections.project_id) AND (p.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = sections.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Authors can delete their comments" ON public.suggestion_comments AS PERMISSIVE FOR DELETE TO authenticated
  USING ((author_user_id = auth.uid()));
CREATE POLICY "Members can insert suggestion comments" ON public.suggestion_comments AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = suggestion_comments.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Members can read suggestion comments" ON public.suggestion_comments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = suggestion_comments.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY uploads_owner_all ON public.uploads AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = uploads.project_id) AND (p.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = uploads.project_id) AND (p.owner_id = auth.uid())))));