import { hasValidCoordinates } from "./geo.js";

export function localToFeature(local) {
  const { lat, lng, ...properties } = local;

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [lng, lat],
    },
    properties,
  };
}

export function toFeatureCollection(locales) {
  const features = locales.filter(hasValidCoordinates).map(localToFeature);

  return {
    type: "FeatureCollection",
    features,
  };
}
