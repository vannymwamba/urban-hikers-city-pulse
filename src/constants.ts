export const BASE_URL = 'https://app.localpulses.com';

const env = (import.meta as any).env ?? {};

export const CARTO_API_KEY: string =
  process.env.CARTO_API_KEY ||
  env.VITE_CARTO_API_KEY ||
  'cb1_5b1b_1_4ed16ff711370e79a0bdd73f';

const rawRasterUrl = env.VITE_CARTO_RASTER_TILE_URL;
export const CARTO_RASTER_TILE_URL: string =
  typeof rawRasterUrl === 'string' &&
  rawRasterUrl.startsWith('https://') &&
  rawRasterUrl.includes('{z}')
    ? rawRasterUrl
    : `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`;

const rawVectorUrl = env.VITE_CARTO_VECTOR_STYLE_URL;
export const CARTO_VECTOR_STYLE_URL: string =
  typeof rawVectorUrl === 'string' && rawVectorUrl.startsWith('https://')
    ? rawVectorUrl
    : `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?key=${CARTO_API_KEY}`;

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

