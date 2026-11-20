CREATE FUNCTION public.auditar_retiro_local()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.verificar_locales
    (local_id, estado_anterior, estado_nuevo, admin_nombre, fecha)
  VALUES
    (NEW.id, 'publicado', 'retirado', auth.jwt() ->> 'email', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER auditar_retiro_local
AFTER UPDATE OF activo ON public.locales
FOR EACH ROW
WHEN (
  OLD.activo IS TRUE AND NEW.activo IS FALSE
  AND (OLD.verificado IS TRUE OR OLD.estado = 'verificado')
  AND (NEW.verificado IS TRUE OR NEW.estado = 'verificado')
)
EXECUTE FUNCTION public.auditar_retiro_local();

-- Retiros previos identificados por su estado actual. Se desconoce cuándo y quién los retiró.
INSERT INTO public.verificar_locales
  (local_id, estado_anterior, estado_nuevo, admin_nombre, fecha)
SELECT l.id, 'publicado', 'retirado', NULL, NULL
FROM public.locales AS l
WHERE l.activo IS FALSE AND (l.verificado IS TRUE OR l.estado = 'verificado')
  AND NOT EXISTS (
    SELECT 1 FROM public.verificar_locales AS h
    WHERE h.local_id = l.id AND h.estado_nuevo = 'retirado'
  );
