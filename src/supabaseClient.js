import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Faltan las variables de entorno de Supabase. Revisa tu archivo .env local."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");




// Prueba rápida de conectividad
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error("❌ Error conectando a Supabase:", error.message);
  } else {
    console.log("✅ Conexión con Supabase exitosa!");
  }
});
