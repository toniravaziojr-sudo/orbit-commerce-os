-- Platform announcements table (admin to all tenants)
CREATE TABLE public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  variant text NOT NULL DEFAULT 'info' CHECK (variant IN ('info', 'warning', 'error', 'success')),
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamp with time zone DEFAULT now(),
  ends_at timestamp with time zone,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

-- Anyone can view active announcements
CREATE POLICY "Anyone can view active announcements"
ON public.platform_announcements
FOR SELECT
USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));

-- Platform admins can manage announcements
CREATE POLICY "Platform admins can manage announcements"
ON public.platform_announcements
FOR ALL
USING (is_platform_admin());

-- Module tutorials table
CREATE TABLE public.module_tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL UNIQUE,
  title text NOT NULL,
  video_url text NOT NULL,
  description text,
  thumbnail_url text,
  duration_minutes integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.module_tutorials ENABLE ROW LEVEL SECURITY;

-- Anyone can view active tutorials
CREATE POLICY "Anyone can view active tutorials"
ON public.module_tutorials
FOR SELECT
USING (is_active = true);

-- Platform admins can manage tutorials
CREATE POLICY "Platform admins can manage tutorials"
ON public.module_tutorials
FOR ALL
USING (is_platform_admin());

-- Create updated_at triggers
CREATE TRIGGER update_platform_announcements_updated_at
BEFORE UPDATE ON public.platform_announcements
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_module_tutorials_updated_at
BEFORE UPDATE ON public.module_tutorials
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();