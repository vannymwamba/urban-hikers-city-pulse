export const BASE_URL = 'https://app.localpulses.com';

const env = (import.meta as any).env ?? {};

export const CARTO_API_KEY: string =
  env.VITE_CARTO_API_KEY || 'cb1_5b1b_1_4ed16ff711370e79a0bdd73f';

export const CARTO_RASTER_TILE_URL: string =
  env.VITE_CARTO_RASTER_TILE_URL ||
  `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`;

export const CARTO_VECTOR_STYLE_URL: string =
  env.VITE_CARTO_VECTOR_STYLE_URL ||
  `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?key=${CARTO_API_KEY}`;

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

