import { useEffect, useState } from "react";
import { actualizarLocalPublicado, getLocalesPublicados } from "./services/localService";

const LOCALES_POR_PASO = 5;

const CAMPOS = [
  ["nombre", "Nombre"],
  ["direccion", "Dirección"],
  ["lat", "Latitud", "number"],
  ["lng", "Longitud", "number"],
  ["abre", "Hora de apertura", "time"],
  ["cierra", "Hora de cierre", "time"],
  ["telefono", "Teléfono", "tel"],
  ["metodo_cobro", "Método de cobro"]
];

function normalizarBusqueda(texto) {
  return String(texto ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export default function GestionarLocales({ categorias, onChanged }) {
  const [locales, setLocales] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [limite, setLimite] = useState(LOCALES_POR_PASO);
  const [form, setForm] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [revision, setRevision] = useState(0);

  const palabras = normalizarBusqueda(busqueda).split(/\s+/).filter(Boolean);
  const localesVisibles = locales.filter((local) => {
    const texto = normalizarBusqueda([local.nombre, local.direccion, local.tipo].join(" "));
    return palabras.every((palabra) => texto.includes(palabra));
  });

  useEffect(() => {
    let vigente = true;
    getLocalesPublicados()
      .then((data) => { if (vigente) setLocales(data); })
      .catch((err) => { if (vigente) setError("No se pudieron cargar los locales: " + err.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [revision]);

  function cambiarCampo(event) {
    const { name, value } = event.target;
    setForm((actual) => ({ ...actual, [name]: value }));
  }

  async function guardar(id, cambios) {
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const actualizacion = await actualizarLocalPublicado(id, cambios);
      setForm(null);
      setConfirmar(null);
      setLocales((actuales) => cambios
        ? actuales.map((local) => local.id === id ? { ...local, ...actualizacion } : local)
        : actuales.filter((local) => local.id !== id));
      setMensaje(cambios ? "Cambios guardados." : "Local retirado del mapa.");
      onChanged(id, actualizacion);
      setRevision((actual) => actual + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section aria-label="Gestionar locales">
      <h3>Locales publicados ({locales.length})</h3>
      <label className="form-group gestion-locales-busqueda" htmlFor="gestionar-locales-busqueda">
        Buscar locales
        <input
          id="gestionar-locales-busqueda"
          type="search"
          placeholder="Nombre, dirección o categoría"
          value={busqueda}
          disabled={guardando || form !== null || confirmar !== null}
          onChange={(event) => {
            setBusqueda(event.target.value);
            setLimite(LOCALES_POR_PASO);
          }}
        />
      </label>
      {error && !form && !confirmar && <p className="form-error-box" role="alert">{error}</p>}
      {mensaje && <p className="form-success-box" role="status">{mensaje}</p>}
      {cargando && <p role="status">Cargando locales…</p>}
      {!cargando && error && !form && !confirmar && (
        <button type="button" className="admin-action-pill" onClick={() => {
          setError("");
          setCargando(true);
          setRevision((actual) => actual + 1);
        }}>Reintentar</button>
      )}
      {!cargando && !error && locales.length === 0 && <p>No hay locales publicados.</p>}
      {!cargando && !error && locales.length > 0 && localesVisibles.length === 0 && (
        <p role="status">No se encontraron locales para esa búsqueda.</p>
      )}
      <ul className="gestion-locales-lista">
        {localesVisibles.slice(0, limite).map((local) => (
          <li key={local.id}>
            <div className="gestion-locales-cabecera">
              <strong>{local.nombre}</strong>
              {form?.id === local.id && (
                <button
                  type="button"
                  className="admin-action-pill gestion-locales-cerrar"
                  aria-label="Cerrar edición"
                  disabled={guardando}
                  onClick={() => setForm(null)}
                >
                  ×
                </button>
              )}
            </div>
            <p>{local.tipo} · {local.direccion}</p>
            {form?.id === local.id ? (
              <form className="register-form" onSubmit={(event) => {
                event.preventDefault();
                guardar(local.id, form);
              }}>
                <fieldset disabled={guardando}>
                  {CAMPOS.map(([name, label, type = "text"]) => (
                    <label className={type === "time" ? "form-group gestion-locales-hora" : "form-group"} key={name}>
                      {label}
                      <input name={name} type={type} value={form[name] ?? ""}
                        onChange={cambiarCampo} step={type === "number" ? "any" : undefined}
                        required={["nombre", "direccion", "lat", "lng"].includes(name)} />
                    </label>
                  ))}
                  <label className="form-group">
                    Categoría
                    <select name="tipo" value={form.tipo} onChange={cambiarCampo} required>
                      {!categorias.includes(form.tipo) && <option value={form.tipo}>{form.tipo}</option>}
                      {categorias.map((tipo) => <option key={tipo}>{tipo}</option>)}
                    </select>
                  </label>
                  <label className="form-group">
                    Descripción
                    <textarea name="descripcion" value={form.descripcion ?? ""} onChange={cambiarCampo} />
                  </label>
                  {error && <p className="form-error-box" role="alert">{error}</p>}
                  <button type="submit" className="admin-action-pill">{guardando ? "Guardando…" : "Guardar cambios"}</button>
                  <button type="button" className="admin-action-pill" onClick={() => setForm(null)}>Cancelar</button>
                </fieldset>
              </form>
            ) : confirmar === local.id ? (
              <div>
                <p>¿Retirar «{local.nombre}» del mapa?</p>
                {error && <p className="form-error-box" role="alert">{error}</p>}
                <button type="button" className="admin-action-pill danger" disabled={guardando}
                  onClick={() => guardar(local.id, null)}>{guardando ? "Retirando…" : "Confirmar eliminación"}</button>
                <button type="button" className="admin-action-pill" disabled={guardando}
                  onClick={() => setConfirmar(null)}>Cancelar</button>
              </div>
            ) : (
              <div>
                <button type="button" className="admin-action-pill" disabled={guardando} onClick={() => {
                  setConfirmar(null);
                  setForm({ ...local });
                  setError("");
                  setMensaje("");
                }}>Editar</button>
                <button type="button" className="admin-action-pill danger" disabled={guardando} onClick={() => {
                  setForm(null);
                  setConfirmar(local.id);
                  setError("");
                  setMensaje("");
                }}>Eliminar</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {localesVisibles.length > limite && (
        <button
          type="button"
          className="admin-action-pill gestion-locales-ver-mas"
          onClick={() => setLimite((actual) => actual + LOCALES_POR_PASO)}
        >
          Ver más
        </button>
      )}
    </section>
  );
}
