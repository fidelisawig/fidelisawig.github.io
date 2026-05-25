/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapLayer, MapFeature } from '../types';

/**
 * Extracts layer features from an ArrayBuffer containing a GeoPackage (.gpkg) file database.
 */
export async function extractGeoPackageLayers(arrayBuffer: ArrayBuffer): Promise<MapLayer[]> {
  try {
    // Dynamically load the geopackage API to avoid blocking initial react bundle loads
    const { GeoPackageAPI, setSqljsWasmLocateFile } = await import('@ngageoint/geopackage');
    
    // Explicitly configure locate file to load local sql-wasm.wasm served at the root
    if (typeof setSqljsWasmLocateFile === 'function') {
      setSqljsWasmLocateFile(() => `/sql-wasm.wasm`);
    }
    
    const uint8Array = new Uint8Array(arrayBuffer);
    const geoPackage = await GeoPackageAPI.open(uint8Array);
    
    if (!geoPackage) {
      throw new Error('Gagal membuka berkas GeoPackage. Penampung basis data kosong.');
    }

    const tableNames = geoPackage.getFeatureTables();
    if (!tableNames || tableNames.length === 0) {
      throw new Error('GeoPackage berhasil dibaca tetapi tidak ditemukan tabel fitur spasial (poligon/vektor).');
    }

    const layers: MapLayer[] = [];

    for (const tableName of tableNames) {
      const features: MapFeature[] = [];
      const geojsonFeatures = geoPackage.queryForGeoJSONFeaturesInTable(tableName, undefined);
      
      let index = 1;
      for (const geojsonFeature of geojsonFeatures) {
        if (geojsonFeature && geojsonFeature.geometry) {
          const geomType = geojsonFeature.geometry.type;
          
          // We only focus on Polygon, MultiPolygon (all polygons) to render scientific boundary maps
          if (geomType === 'Polygon' || geomType === 'MultiPolygon' || geomType === 'LineString' || geomType === 'MultiLineString' || geomType === 'Point') {
            features.push({
              id: geojsonFeature.id || index++,
              type: 'Feature',
              geometry: geojsonFeature.geometry,
              properties: geojsonFeature.properties || {},
              layerId: tableName,
            });
          }
        }
      }

      if (features.length > 0) {
        // Generate automatic distinctive colors for distinct tables
        const randomColor = getRandomLayerColor(layers.length);
        layers.push({
          id: tableName,
          name: tableName.toUpperCase() + ' (GPKG)',
          features,
          visible: true,
          color: randomColor.fill,
          strokeColor: randomColor.stroke,
          strokeWidth: 1.5,
          fillOpacity: 0.35,
        });
      }
    }

    return layers;
  } catch (error: any) {
    console.error('GeoPackage loading failed:', error);
    throw new Error(
      `Kesalahan parsing GeoPackage: ${error?.message || error || 'Masalah loading SQLite library.'}\n` +
      `Saran: Jika berkas GPKG dilindungi sandboxing atau berukuran besar, Anda bisa mengonversi ke GeoJSON menggunakan QGIS atau converter online untuk pemrosesan instan.`
    );
  }
}

/**
 * Aesthetic generator for distinct default layer colors
 */
function getRandomLayerColor(index: number) {
  const presets = [
    { fill: '#93c5fd', stroke: '#1d4ed8' }, // Blue
    { fill: '#6ee7b7', stroke: '#047857' }, // Emerald
    { fill: '#fde68a', stroke: '#b45309' }, // Amber
    { fill: '#fca5a5', stroke: '#b91c1c' }, // Red
    { fill: '#d8b4fe', stroke: '#6d28d9' }, // Purple
    { fill: '#f9a8d4', stroke: '#be185d' }, // Pink
    { fill: '#cbd5e1', stroke: '#475569' }, // Slate
  ];
  return presets[index % presets.length];
}
