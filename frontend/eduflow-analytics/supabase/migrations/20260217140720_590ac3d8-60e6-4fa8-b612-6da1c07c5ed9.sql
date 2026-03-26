
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('student', 'teacher');
CREATE TYPE public.question_type AS ENUM ('mcq', 'true_false');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer helper functions (bypass RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_teacher(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'teacher')
$$;

CREATE OR REPLACE FUNCTION public.is_student(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'student')
$$;

-- Tests table
CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT false,
  duration_minutes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

-- Questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type question_type NOT NULL DEFAULT 'mcq',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT NOT NULL,
  points INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Test attempts (tracks each time a student takes a test)
CREATE TABLE public.test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  score NUMERIC(5,2) DEFAULT 0,
  total_points INT DEFAULT 0,
  earned_points INT DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

-- Student responses
CREATE TABLE public.student_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_answer TEXT,
  is_correct BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.student_responses ENABLE ROW LEVEL SECURITY;

-- Feedback from teachers
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_preset BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  -- Auto-assign role from metadata
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON public.tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =================== RLS POLICIES ===================

-- Profiles: everyone authenticated can read, users update own
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles: users can read own role, role assigned via trigger
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Tests: teachers CRUD own, students read published
CREATE POLICY "Teachers can create tests" ON public.tests FOR INSERT TO authenticated WITH CHECK (public.is_teacher(auth.uid()) AND teacher_id = auth.uid());
CREATE POLICY "Anyone can view published tests" ON public.tests FOR SELECT TO authenticated USING (is_published = true OR teacher_id = auth.uid());
CREATE POLICY "Teachers can update own tests" ON public.tests FOR UPDATE TO authenticated USING (teacher_id = auth.uid() AND public.is_teacher(auth.uid()));
CREATE POLICY "Teachers can delete own tests" ON public.tests FOR DELETE TO authenticated USING (teacher_id = auth.uid() AND public.is_teacher(auth.uid()));

-- Questions: teachers CRUD for own tests, students read for published tests
CREATE POLICY "Users can view questions for accessible tests" ON public.questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tests WHERE tests.id = questions.test_id AND (tests.is_published = true OR tests.teacher_id = auth.uid())));
CREATE POLICY "Teachers can insert questions" ON public.questions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tests WHERE tests.id = questions.test_id AND tests.teacher_id = auth.uid()));
CREATE POLICY "Teachers can update questions" ON public.questions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tests WHERE tests.id = questions.test_id AND tests.teacher_id = auth.uid()));
CREATE POLICY "Teachers can delete questions" ON public.questions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tests WHERE tests.id = questions.test_id AND tests.teacher_id = auth.uid()));

-- Test attempts: students CRUD own, teachers read for own tests
CREATE POLICY "Students can create attempts" ON public.test_attempts FOR INSERT TO authenticated
  WITH CHECK (public.is_student(auth.uid()) AND student_id = auth.uid());
CREATE POLICY "Students view own attempts" ON public.test_attempts FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.tests WHERE tests.id = test_attempts.test_id AND tests.teacher_id = auth.uid()));
CREATE POLICY "Students can update own attempts" ON public.test_attempts FOR UPDATE TO authenticated
  USING (student_id = auth.uid());

-- Student responses: students insert own, read own + teacher reads for own tests
CREATE POLICY "Students can submit responses" ON public.student_responses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.test_attempts WHERE test_attempts.id = student_responses.attempt_id AND test_attempts.student_id = auth.uid()));
CREATE POLICY "Users can view responses" ON public.student_responses FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.test_attempts WHERE test_attempts.id = student_responses.attempt_id AND test_attempts.student_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.test_attempts
      JOIN public.tests ON tests.id = test_attempts.test_id
      WHERE test_attempts.id = student_responses.attempt_id AND tests.teacher_id = auth.uid()
    )
  );

-- Feedback: teachers CRUD for own tests, students read own
CREATE POLICY "Teachers can create feedback" ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher(auth.uid()) AND teacher_id = auth.uid());
CREATE POLICY "Users can view feedback" ON public.feedback FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.test_attempts WHERE test_attempts.id = feedback.attempt_id AND test_attempts.student_id = auth.uid())
  );
CREATE POLICY "Teachers can update own feedback" ON public.feedback FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can delete own feedback" ON public.feedback FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());
