import { neon } from '@neondatabase/serverless';
import { GeographicBounds, MapFeature, MapLayer } from '../types';

const LS_URL_KEY = 'wilayahstudi_neon_url';
const LS_CONFIG_KEY = 'wilayahstudi_db_config';

export interface DbConfig {
  tableName: string;
  nameColumn: string;
  geomColumn: string;
}

export function getDbUrl(): string {
  return (import.meta.env.VITE_NEON_DATABASE_URL as string) || localStorage.getItem(LS_URL_KEY) || '';
}

export function saveDbUrl(url: string) {
  localStorage.setItem(LS_URL_KEY, url);
}

export function loadDbConfig(): DbConfig {
  try {
    const stored = localStorage.getItem(LS_CONFIG_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { tableName: '', nameColumn: 'nama', geomColumn: 'geom' };
}

export function saveDbConfig(config: DbConfig) {
  localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config));
}

// Strips non-identifier characters to prevent SQL injection in table/column names
function safeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, '');
}

export async function fetchGeometryNames(query: string, config: DbConfig): Promise<string[]> {
  const url = getDbUrl();
  if (!url) throw new Error('URL database belum diatur');

  const sql = neon(url);
  const t = safeId(config.tableName);
  const c = safeId(config.nameColumn);

  if (!t || !c) throw new Error('Nama tabel atau kolom tidak valid');

  const rows = await sql(
    `SELECT DISTINCT "${c}" AS name FROM "${t}" WHERE "${c}" ILIKE $1 ORDER BY "${c}" LIMIT 30`,
    [`%${query}%`]
  );
  return (rows as any[]).map((r) => r.name).filter(Boolean);
}

export async function fetchGeometryByName(
  name: string,
  config: DbConfig
): Promise<{ layer: MapLayer; bounds: GeographicBounds }> {
  const url = getDbUrl();
  if (!url) throw new Error('URL database belum diatur');

  const sql = neon(url);
  const t = safeId(config.tableName);
  const c = safeId(config.nameColumn);
  const g = safeId(config.geomColumn);

  if (!t || !c || !g) throw new Error('Konfigurasi kolom tidak valid');

  const rows = await sql(
    `SELECT "${c}" AS name, ST_AsGeoJSON(ST_Transform("${g}", 4326)) AS geojson,
            ST_XMin(ST_Envelope(ST_Transform("${g}", 4326))) AS min_lng,
            ST_YMin(ST_Envelope(ST_Transform("${g}", 4326))) AS min_lat,
            ST_XMax(ST_Envelope(ST_Transform("${g}", 4326))) AS max_lng,
            ST_YMax(ST_Envelope(ST_Transform("${g}", 4326))) AS max_lat
     FROM "${t}" WHERE "${c}" = $1`,
    [name]
  ) as any[];

  if (!rows.length) throw new Error(`Geometri "${name}" tidak ditemukan`);

  const features: MapFeature[] = rows.map((row, i) => ({
    id: `db_${i}`,
    type: 'Feature',
    layerId: 'db_layer',
    geometry: JSON.parse(row.geojson),
    properties: { name: row.name },
  }));

  // Union bounding box across all returned rows
  const bounds: GeographicBounds = rows.reduce(
    (acc, row) => ({
      minLng: Math.min(acc.minLng, parseFloat(row.min_lng)),
      minLat: Math.min(acc.minLat, parseFloat(row.min_lat)),
      maxLng: Math.max(acc.maxLng, parseFloat(row.max_lng)),
      maxLat: Math.max(acc.maxLat, parseFloat(row.max_lat)),
    }),
    {
      minLng: Infinity,
      minLat: Infinity,
      maxLng: -Infinity,
      maxLat: -Infinity,
    }
  );

  // Add 10% padding around the geometry
  const padLng = (bounds.maxLng - bounds.minLng) * 0.1;
  const padLat = (bounds.maxLat - bounds.minLat) * 0.1;
  bounds.minLng -= padLng;
  bounds.maxLng += padLng;
  bounds.minLat -= padLat;
  bounds.maxLat += padLat;

  const layer: MapLayer = {
    id: 'db_layer',
    name: name,
    features,
    visible: true,
    color: '#eff6ff',
    strokeColor: '#1e3a8a',
    strokeWidth: 2,
    fillOpacity: 0.3,
  };

  return { layer, bounds };
}
