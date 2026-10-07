import { Router } from "express";
import { getLocales } from "../data/store.js";
import { applyLocalFilters } from "../utils/filters.js";
import {
  distanceKm,
  hasValidCoordinates,
  isInsideBbox,
  isValidLatitude,
  isValidLongitude,
  parseCoordinate,
} from "../utils/geo.js";
import { toFeatureCollection } from "../utils/geojson.js";

const router = Router();

function withDistance(local, lat, lng) {
  return {
    ...local,
    distancia_km: Number(distanceKm(lat, lng, local.lat, local.lng).toFixed(3)),
  };
}

router.get("/", (req, res) => {
  const { q, tipo, verificado, format } = req.query;
  const results = applyLocalFilters(getLocales(), { q, tipo, verificado });

  if (format === "geojson") {
    res.json(toFeatureCollection(results));
    return;
  }

  res.json({
    query: q ?? "",
    count: results.length,
    locales: results,
  });
});

router.get("/nearby", (req, res) => {
  const lat = parseCoordinate(req.query.lat);
  const lng = parseCoordinate(req.query.lng);
  const radius = parseCoordinate(req.query.radius) ?? 1.5;

  if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
    res.status(400).json({
      error: "Parámetros lat y lng son obligatorios y deben ser coordenadas válidas",
    });
    return;
  }

  if (!Number.isFinite(radius) || radius <= 0) {
    res.status(400).json({ error: "radius debe ser un número positivo (kilómetros)" });
    return;
  }

  const { q, tipo, verificado } = req.query;
  const filtered = applyLocalFilters(getLocales(), { q, tipo, verificado })
    .filter(hasValidCoordinates)
    .map((local) => withDistance(local, lat, lng))
    .filter((local) => local.distancia_km <= radius)
    .sort((a, b) => a.distancia_km - b.distancia_km);

  res.json({
    origin: { lat, lng },
    radius_km: radius,
    count: filtered.length,
    locales: filtered,
  });
});

router.get("/bbox", (req, res) => {
  const minLat = parseCoordinate(req.query.minLat);
  const minLng = parseCoordinate(req.query.minLng);
  const maxLat = parseCoordinate(req.query.maxLat);
  const maxLng = parseCoordinate(req.query.maxLng);

  const bbox = { minLat, minLng, maxLat, maxLng };
  const valid =
    isValidLatitude(minLat) &&
    isValidLatitude(maxLat) &&
    isValidLongitude(minLng) &&
    isValidLongitude(maxLng) &&
    minLat <= maxLat &&
    minLng <= maxLng;

  if (!valid) {
    res.status(400).json({
      error:
        "Se requieren minLat, minLng, maxLat y maxLng con un bounding box válido [longitud, latitud]",
    });
    return;
  }

  const { q, tipo, verificado, format } = req.query;
  const results = applyLocalFilters(getLocales(), { q, tipo, verificado }).filter(
    (local) => hasValidCoordinates(local) && isInsideBbox(local, bbox)
  );

  if (format === "geojson") {
    res.json(toFeatureCollection(results));
    return;
  }

  res.json({
    bbox,
    count: results.length,
    locales: results,
  });
});

export default router;
