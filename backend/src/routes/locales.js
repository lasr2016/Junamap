import { Router } from "express";
import { getLocalById, getLocales, getTipos } from "../data/store.js";
import { applyLocalFilters } from "../utils/filters.js";
import { toFeatureCollection } from "../utils/geojson.js";

const router = Router();

router.get("/", (req, res) => {
  const { q, tipo, verificado } = req.query;
  const results = applyLocalFilters(getLocales(), { q, tipo, verificado });

  res.json({
    count: results.length,
    locales: results,
  });
});

router.get("/geojson", (req, res) => {
  const { q, tipo, verificado } = req.query;
  const results = applyLocalFilters(getLocales(), { q, tipo, verificado });

  res.json(toFeatureCollection(results));
});

router.get("/tipos", (_req, res) => {
  res.json({ tipos: getTipos() });
});

router.get("/:id", (req, res) => {
  const local = getLocalById(req.params.id);

  if (!local) {
    res.status(404).json({ error: "Local no encontrado" });
    return;
  }

  res.json(local);
});

export default router;
