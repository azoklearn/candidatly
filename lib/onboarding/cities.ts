/**
 * Cities offered at the location step (docs/QUESTIONS.md C92), so that the questionnaire
 * can be answered with clicks only. Coordinates and INSEE codes come from the Géoplateforme
 * geocoder (docs/API_ADRESSE.md), read once and stored here: choosing one calls no API.
 */

export type PresetCity = {
  id: string;
  label: string;
  insee: string;
  lat: number;
  lng: number;
};

export const PRESET_CITIES: readonly PresetCity[] = [
  { id: "paris", label: "Paris", insee: "75056", lat: 48.859, lng: 2.347 },
  { id: "lyon", label: "Lyon", insee: "69123", lat: 45.758, lng: 4.835 },
  { id: "marseille", label: "Marseille", insee: "13055", lat: 43.282, lng: 5.405 },
  { id: "toulouse", label: "Toulouse", insee: "31555", lat: 43.604082, lng: 1.433805 },
  { id: "lille", label: "Lille", insee: "59350", lat: 50.630951, lng: 3.045391 },
  { id: "bordeaux", label: "Bordeaux", insee: "33063", lat: 44.851939, lng: -0.587877 },
  { id: "nantes", label: "Nantes", insee: "44109", lat: 47.239367, lng: -1.555335 },
  { id: "strasbourg", label: "Strasbourg", insee: "67482", lat: 48.579831, lng: 7.761454 },
  { id: "montpellier", label: "Montpellier", insee: "34172", lat: 43.610476, lng: 3.87048 },
  { id: "rennes", label: "Rennes", insee: "35238", lat: 48.110899, lng: -1.68365 },
  { id: "nice", label: "Nice", insee: "06088", lat: 43.71273, lng: 7.255313 },
  { id: "grenoble", label: "Grenoble", insee: "38185", lat: 45.182828, lng: 5.724301 },
];

export function findPresetCity(id: string | null | undefined): PresetCity | null {
  return PRESET_CITIES.find((city) => city.id === id) ?? null;
}

export const RADIUS_OPTIONS = [10, 20, 30, 50, 100] as const;
export const DEFAULT_RADIUS_KM = 30;
