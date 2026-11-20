CREATE POLICY "Solo moderador autenticado puede actualizar locales"
ON public.locales AS RESTRICTIVE FOR UPDATE TO anon, authenticated
USING ((select auth.uid()) IS NOT NULL AND (select lower(auth.jwt() ->> 'email')) = 'webjunamap@gmail.com')
WITH CHECK ((select auth.uid()) IS NOT NULL AND (select lower(auth.jwt() ->> 'email')) = 'webjunamap@gmail.com');
