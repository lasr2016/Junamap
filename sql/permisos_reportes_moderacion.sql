DROP POLICY IF EXISTS "Lectura y gestion exclusiva para administradores" ON public.reportes_locales;

GRANT SELECT, UPDATE ON public.reportes_locales TO authenticated;

CREATE POLICY "Moderador puede leer reportes"
ON public.reportes_locales FOR SELECT TO authenticated
USING ((select auth.uid()) IS NOT NULL AND (select lower(auth.jwt() ->> 'email')) = 'webjunamap@gmail.com');

CREATE POLICY "Moderador puede actualizar reportes"
ON public.reportes_locales FOR UPDATE TO authenticated
USING ((select auth.uid()) IS NOT NULL AND (select lower(auth.jwt() ->> 'email')) = 'webjunamap@gmail.com')
WITH CHECK ((select auth.uid()) IS NOT NULL AND (select lower(auth.jwt() ->> 'email')) = 'webjunamap@gmail.com');
