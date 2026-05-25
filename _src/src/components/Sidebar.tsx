/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  MapLayer,
  MapSettings,
  MapLabel,
  GeographicBounds,
  LAYOUTS,
  LAYOUTS as LAYOUT_TEMPLATES,
  COLOR_PRESETS,
  LayoutTemplate,
  ColorTheme,
} from '../types';
import { INDONESIAN_PRESETS } from './IndonesianPresets';
import { parseKMLToGeoJSON, getRecommendedScaleLength, calculateRepresentativeScale } from '../utils/geo';
import { extractGeoPackageLayers } from '../utils/gpkg';
import {
  fetchGeometryNames,
  fetchGeometryByName,
  getDbUrl,
  saveDbUrl,
  loadDbConfig,
  saveDbConfig,
  type DbConfig,
} from '../utils/db';
import {
  Upload,
  Globe,
  Settings,
  Layers,
  MapPin,
  Compass,
  Type,
  Trash2,
  List,
  Eye,
  EyeOff,
  Plus,
  Compass as CompassIcon,
  BookOpen,
  Info,
  CheckCircle,
  Layout,
  Printer,
  Database,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
} from 'lucide-react';

interface SidebarProps {
  layers: MapLayer[];
  settings: MapSettings;
  bounds: GeographicBounds;
  labels: MapLabel[];
  onUpdateLayers: (layers: MapLayer[]) => void;
  onUpdateSettings: (settings: Partial<MapSettings>) => void;
  onUpdateLabels: (labels: MapLabel[]) => void;
  onUpdateBounds: (bounds: GeographicBounds) => void;
  selectedFeature: any | null;
  onSelectFeature: (feature: any | null) => void;
  onLoadPreset: (presetId: string) => void;
}

export default function Sidebar({
  layers,
  settings,
  bounds,
  labels,
  onUpdateLayers,
  onUpdateSettings,
  onUpdateLabels,
  onUpdateBounds,
  selectedFeature,
  onSelectFeature,
  onLoadPreset,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'presets' | 'data' | 'layout' | 'labels' | 'feature'>('presets');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New text label inputs state
  const [newLabelText, setNewLabelText] = useState('');
  const [newLabelSize, setNewLabelSize] = useState(10);
  const [newLabelWeight, setNewLabelWeight] = useState<'normal' | 'bold'>('normal');
  const [newLabelColor, setNewLabelColor] = useState('');
  const [newLabelAngle, setNewLabelAngle] = useState(0);

  // DB selector state
  const [dbUrl, setDbUrlState] = useState<string>(getDbUrl);
  const [dbConfig, setDbConfigState] = useState<DbConfig>(loadDbConfig);
  const [dbSearch, setDbSearch] = useState('');
  const [dbResults, setDbResults] = useState<string[]>([]);
  const [dbSelected, setDbSelected] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showDbConfig, setShowDbConfig] = useState(false);
  const [showDemoPresets, setShowDemoPresets] = useState(false);
  const dbSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDbUrlChange = (val: string) => {
    setDbUrlState(val);
    saveDbUrl(val);
  };

  const handleDbConfigChange = (patch: Partial<DbConfig>) => {
    const next = { ...dbConfig, ...patch };
    setDbConfigState(next);
    saveDbConfig(next);
    setDbResults([]);
    setDbSelected(null);
  };

  const handleDbSearch = (query: string) => {
    setDbSearch(query);
    setDbSelected(null);
    if (dbSearchTimeout.current) clearTimeout(dbSearchTimeout.current);
    if (!query.trim() || !dbConfig.tableName || !dbConfig.nameColumn) {
      setDbResults([]);
      return;
    }
    dbSearchTimeout.current = setTimeout(async () => {
      setDbLoading(true);
      setDbError(null);
      try {
        const names = await fetchGeometryNames(query, dbConfig);
        setDbResults(names);
      } catch (e: any) {
        setDbError(e.message);
        setDbResults([]);
      } finally {
        setDbLoading(false);
      }
    }, 400);
  };

  const handleLoadDbGeometry = async () => {
    if (!dbSelected) return;
    setDbLoading(true);
    setDbError(null);
    try {
      const { layer, bounds: newBounds } = await fetchGeometryByName(dbSelected, dbConfig);
      onUpdateLayers([layer]);
      onUpdateBounds(newBounds);
      onUpdateLabels([]);
      const dLng = newBounds.maxLng - newBounds.minLng;
      const dLat = newBounds.maxLat - newBounds.minLat;
      const scale = getRecommendedScaleLength(newBounds);
      onUpdateSettings({
        title: dbSelected.toUpperCase(),
        subtitle: `${dbConfig.tableName} — ${dbSelected}`,
        scaleBarLengthKm: scale.length,
        scaleBarUnit: scale.unit,
        graticuleStep: Number((Math.max(dLng, dLat) / 4).toFixed(3)) || 0.01,
      });
    } catch (e: any) {
      setDbError(e.message);
    } finally {
      setDbLoading(false);
    }
  };

  // Bounds manual editors state
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [manualMinLng, setManualMinLng] = useState(bounds.minLng.toFixed(5));
  const [manualMaxLng, setManualMaxLng] = useState(bounds.maxLng.toFixed(5));
  const [manualMinLat, setManualMinLat] = useState(bounds.minLat.toFixed(5));
  const [manualMaxLat, setManualMaxLat] = useState(bounds.maxLat.toFixed(5));

  // Syncing bounds fields when bounds change in parent
  React.useEffect(() => {
    setManualMinLng(bounds.minLng.toFixed(5));
    setManualMaxLng(bounds.maxLng.toFixed(5));
    setManualMinLat(bounds.minLat.toFixed(5));
    setManualMaxLat(bounds.maxLat.toFixed(5));
  }, [bounds]);

  // Handle boundary save coordinates manually
  const handleApplyBounds = () => {
    const minLng = parseFloat(manualMinLng);
    const maxLng = parseFloat(manualMaxLng);
    const minLat = parseFloat(manualMinLat);
    const maxLat = parseFloat(manualMaxLat);

    if (!isNaN(minLng) && !isNaN(maxLng) && !isNaN(minLat) && !isNaN(maxLat)) {
      if (minLng < maxLng && minLat < maxLat) {
        onUpdateBounds({ minLng, maxLng, minLat, maxLat });
        setUploadError(null);
      } else {
        setUploadError('Koordinat batas minimum harus lebih kecil dari batas maksimum.');
      }
    } else {
      setUploadError('Harap masukkan angka koordinat lintang/bujur yang valid.');
    }
  };

  // Process File uploads (GeoPackage GPKG, GeoJSON, KML)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const fileName = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    try {
      const reader = new FileReader();

      if (fileName === '.gpkg') {
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            if (!arrayBuffer) throw new Error('Berkas kosong.');
            
            const newLayers = await extractGeoPackageLayers(arrayBuffer);
            
            // Adjust bounds to encompass the newly imported layers
            if (newLayers.length > 0) {
              fitBoundsOfLayers(newLayers);
              // Append or overwrite
              onUpdateLayers([...layers, ...newLayers]);
            }
          } catch (err: any) {
            setUploadError(err.message || 'Gagal memuat GeoPackage.');
          } finally {
            setUploading(false);
          }
        };
        reader.readAsArrayBuffer(file);

      } else if (fileName === '.geojson' || fileName === '.json') {
        reader.onload = (event) => {
          try {
            const text = event.target?.result as string;
            const geojson = JSON.parse(text);
            const parsedLayers = parseGeoJSONLayers(geojson, file.name);
            
            if (parsedLayers.length > 0) {
              fitBoundsOfLayers(parsedLayers);
              onUpdateLayers([...layers, ...parsedLayers]);
            }
          } catch (err: any) {
            setUploadError('Gagal memproses berkas GeoJSON. Pastikan format valid.');
          } finally {
            setUploading(false);
          }
        };
        reader.readAsText(file);

      } else if (fileName === '.kml') {
        reader.onload = (event) => {
          try {
            const text = event.target?.result as string;
            const geojson = parseKMLToGeoJSON(text);
            const parsedLayers = parseGeoJSONLayers(geojson, file.name);
            
            if (parsedLayers.length > 0) {
              fitBoundsOfLayers(parsedLayers);
              onUpdateLayers([...layers, ...parsedLayers]);
            }
          } catch (err: any) {
            setUploadError('Gagal memproses berkas KML. Pastikan fail adalah KML XML standar.');
          } finally {
            setUploading(false);
          }
        };
        reader.readAsText(file);

      } else {
        setUploadError('Ekstensi berkas tidak dikenal. Program mendukung tipe basis data .gpkg, .geojson, atau .kml');
        setUploading(false);
      }
    } catch (err: any) {
      setUploadError('Gagal membaca berkas: ' + err.message);
      setUploading(false);
    }
  };

  // Helper parser for raw GeoJSON objects
  const parseGeoJSONLayers = (geojson: any, sourceName: string): MapLayer[] => {
    if (!geojson) return [];
    
    let featuresList: any[] = [];
    if (geojson.type === 'FeatureCollection') {
      featuresList = geojson.features;
    } else if (geojson.type === 'Feature') {
      featuresList = [geojson];
    } else if (geojson.type === 'GeometryCollection') {
      featuresList = geojson.geometries.map((g: any, i: number) => ({
        type: 'Feature',
        id: i,
        geometry: g,
        properties: {},
      }));
    } else {
      throw new Error('Format GeoJSON tidak didukung.');
    }

    const cleanedFeatures = featuresList.map((f, i) => ({
      id: f.id || i + 1,
      type: 'Feature' as const,
      geometry: f.geometry,
      properties: f.properties || {},
      layerId: sourceName,
    }));

    return [
      {
        id: sourceName,
        name: sourceName.toUpperCase(),
        visible: true,
        color: '#cbd5e1',
        strokeColor: '#334155',
        strokeWidth: 1.5,
        fillOpacity: 0.35,
        features: cleanedFeatures,
      },
    ];
  };

  // Re-zoom visible bounding block to encapsulate spatial coordinates of active layers
  const fitBoundsOfLayers = (targetLayers: MapLayer[]) => {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    targetLayers.forEach((lyr) => {
      lyr.features.forEach((feature) => {
        const processCoordinate = (coord: [number, number]) => {
          if (coord[0] < minLng) minLng = coord[0];
          if (coord[0] > maxLng) maxLng = coord[0];
          if (coord[1] < minLat) minLat = coord[1];
          if (coord[1] > maxLat) maxLat = coord[1];
        };

        const processGeometry = (geom: any) => {
          if (!geom) return;
          const { type, coordinates } = geom;
          if (type === 'Point') {
            processCoordinate(coordinates);
          } else if (type === 'LineString' || type === 'Polygon') {
            coordinates.forEach((ring: any) => {
              if (type === 'Polygon') {
                ring.forEach(processCoordinate);
              } else {
                processCoordinate(ring);
              }
            });
          } else if (type === 'MultiPolygon') {
            coordinates.forEach((poly: any) => {
              poly.forEach((ring: any) => ring.forEach(processCoordinate));
            });
          } else if (type === 'MultiLineString') {
            coordinates.forEach((line: any) => line.forEach(processCoordinate));
          }
        };

        processGeometry(feature.geometry);
      });
    });

    if (minLng !== Infinity && maxLng !== -Infinity && minLat !== Infinity && maxLat !== -Infinity) {
      // Add a 10% safety padding margin around limits
      const dLng = maxLng - minLng || 0.01;
      const dLat = maxLat - minLat || 0.01;
      const newBounds = {
        minLng: minLng - dLng * 0.1,
        maxLng: maxLng + dLng * 0.1,
        minLat: minLat - dLat * 0.1,
        maxLat: maxLat + dLat * 0.1,
      };
      
      onUpdateBounds(newBounds);

      // Instantly optimize recommended scale ruler
      const scaleRecommend = getRecommendedScaleLength(newBounds);
      onUpdateSettings({
        scaleBarLengthKm: scaleRecommend.length,
        scaleBarUnit: scaleRecommend.unit,
        graticuleStep: Number((dLng / 3).toFixed(3)) || 0.01,
      });
    }
  };

  // Layer editing controllers
  const updateLayerStyles = (layerId: string, updates: Partial<MapLayer>) => {
    onUpdateLayers(
      layers.map((l) => (l.id === layerId ? { ...l, ...updates } : l))
    );
  };

  const removeLayer = (layerId: string) => {
    onUpdateLayers(layers.filter((l) => l.id !== layerId));
    if (selectedFeature && selectedFeature.layerId === layerId) {
      onSelectFeature(null);
    }
  };

  // Quick Layer category field styling toggles
  const applyUniqueCategoryStyling = (layerId: string, fieldName: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    // Get unique values for this field across features
    const uniqueValues = Array.from(
      new Set(layer.features.map(f => f.properties[fieldName]).filter(Boolean))
    ) as string[];

    const colorsPreset = COLOR_PRESETS[settings.theme].palette;
    const colorMap: Record<string, string> = {};
    
    uniqueValues.forEach((val, idx) => {
      colorMap[val] = colorsPreset[idx % colorsPreset.length];
    });

    updateLayerStyles(layerId, {
      categoryField: fieldName,
      categoriesColorMap: colorMap,
    });
  };

  const clearUniqueCategoryStyling = (layerId: string) => {
    updateLayerStyles(layerId, {
      categoryField: undefined,
      categoriesColorMap: undefined,
    });
  };

  // Add custom floating tag annotation labels
  const handleAddLabel = () => {
    if (!newLabelText.trim()) return;

    const midLat = (bounds.minLat + bounds.maxLat) / 2;
    const midLng = (bounds.minLng + bounds.maxLng) / 2;

    const newLabel: MapLabel = {
      id: 'lbl_' + Date.now(),
      text: newLabelText,
      x: 50, // center layout placement initially
      y: 50,
      lat: midLat, // coordinates mapped
      lng: midLng,
      fontSize: newLabelSize,
      fontWeight: newLabelWeight,
      color: newLabelColor || COLOR_PRESETS[settings.theme].text,
      angle: newLabelAngle,
      isUserAdded: true,
    };

    onUpdateLabels([...labels, newLabel]);
    setNewLabelText('');
  };

  // Delete labels
  const handleRemoveLabel = (id: string) => {
    onUpdateLabels(labels.filter((l) => l.id !== id));
  };

  return (
    <div className="w-full lg:w-[420px] bg-white border-l lg:border-l border-slate-200 flex flex-col h-full text-slate-800">
      {/* Mini App Branding */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-700" />
          <h1 className="text-sm font-bold tracking-wider uppercase text-slate-900 font-sans">
            Panel Kartografi
          </h1>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="grid grid-cols-5 bg-slate-100 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('presets')}
          className={`flex flex-col items-center py-2 text-[10px] font-bold tracking-wide uppercase transition-colors ${
            activeTab === 'presets' ? 'text-blue-700 bg-white border-b-2 border-blue-700' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Prasetel Batas Wilayah Indonesia"
        >
          <BookOpen className="w-4 h-4 mb-1" />
          Prasetel
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`flex flex-col items-center py-2 text-[10px] font-bold tracking-wide uppercase transition-colors ${
            activeTab === 'data' ? 'text-blue-700 bg-white border-b-2 border-blue-700' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Unggah Data Geopackage / KML / GeoJSON"
        >
          <Layers className="w-4 h-4 mb-1" />
          Import
        </button>
        <button
          onClick={() => setActiveTab('layout')}
          className={`flex flex-col items-center py-2 text-[10px] font-bold tracking-wide uppercase transition-colors ${
            activeTab === 'layout' ? 'text-blue-700 bg-white border-b-2 border-blue-700' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Dimensi Kertas Graticule Kompas Skala"
        >
          <Settings className="w-4 h-4 mb-1" />
          Layout
        </button>
        <button
          onClick={() => setActiveTab('labels')}
          className={`flex flex-col items-center py-2 text-[10px] font-bold tracking-wide uppercase transition-colors ${
            activeTab === 'labels' ? 'text-blue-700 bg-white border-b-2 border-blue-700' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Tambahkan Teks Wilayah / Nama Desa"
        >
          <Type className="w-4 h-4 mb-1" />
          Teks
        </button>
        <button
          onClick={() => setActiveTab('feature')}
          className={`flex flex-col items-center py-2 text-[10px] font-bold tracking-wide uppercase transition-colors ${
            activeTab === 'feature' ? 'text-blue-700 bg-white border-b-2 border-blue-700' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Detail Atribut Fitur yang Dipilih"
        >
          <List className="w-4 h-4 mb-1" />
          Atribut
        </button>
      </div>

      {/* Sidebar Content Panel Frame */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Error notification display block */}
        {uploadError && (
          <div className="bg-red-950/80 border border-red-800 text-red-200 p-4 rounded-lg flex gap-3 text-xs leading-relaxed">
            <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Pemberitahuan:</p>
              <p>{uploadError}</p>
            </div>
          </div>
        )}

        {/* TAB 1: DB GEOMETRY SELECTOR + DEMO PRESETS */}
        {activeTab === 'presets' && (
          <div className="space-y-4 animate-fadeIn">

            {/* ── DATABASE NEONDB SECTION ── */}
            <div className="border border-slate-200 rounded-none shadow-sm">
              <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-[10px] font-bold tracking-widest uppercase">Database NeonDB / PostgreSQL</span>
                <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${dbUrl ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-slate-300'}`}>
                  {dbUrl ? 'TERHUBUNG' : 'BELUM DIATUR'}
                </span>
              </div>

              <div className="p-4 space-y-3">

                {/* DB URL toggle */}
                <button
                  onClick={() => setShowDbConfig(v => !v)}
                  className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings className="w-3 h-3" /> Konfigurasi Koneksi
                  </span>
                  {showDbConfig ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                {showDbConfig && (
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        URL Database (postgres://…)
                      </label>
                      <input
                        type="password"
                        value={dbUrl}
                        onChange={e => handleDbUrlChange(e.target.value)}
                        placeholder="postgres://user:pass@host/db"
                        className="w-full text-xs border border-slate-300 bg-slate-50 px-3 py-2 rounded-none focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[9px] text-slate-400 mt-1">Disimpan di localStorage browser Anda.</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Tabel</label>
                        <input
                          type="text"
                          value={dbConfig.tableName}
                          onChange={e => handleDbConfigChange({ tableName: e.target.value })}
                          placeholder="nama_tabel"
                          className="w-full text-xs border border-slate-300 bg-slate-50 px-2 py-1.5 rounded-none focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Kol. Nama</label>
                        <input
                          type="text"
                          value={dbConfig.nameColumn}
                          onChange={e => handleDbConfigChange({ nameColumn: e.target.value })}
                          placeholder="nama"
                          className="w-full text-xs border border-slate-300 bg-slate-50 px-2 py-1.5 rounded-none focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Kol. Geom</label>
                        <input
                          type="text"
                          value={dbConfig.geomColumn}
                          onChange={e => handleDbConfigChange({ geomColumn: e.target.value })}
                          placeholder="geom"
                          className="w-full text-xs border border-slate-300 bg-slate-50 px-2 py-1.5 rounded-none focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Search input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Cari Nama Geometri
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={dbSearch}
                      onChange={e => handleDbSearch(e.target.value)}
                      placeholder={dbConfig.tableName ? `Ketik nama di ${dbConfig.tableName}…` : 'Atur tabel terlebih dahulu'}
                      disabled={!dbConfig.tableName || !dbConfig.nameColumn}
                      className="w-full text-xs border border-slate-300 bg-slate-50 pl-8 pr-8 py-2 rounded-none focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {dbLoading && (
                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-600 animate-spin" />
                    )}
                    {!dbLoading && dbSearch && (
                      <button
                        onClick={() => { setDbSearch(''); setDbResults([]); setDbSelected(null); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Results list */}
                {dbResults.length > 0 && (
                  <div className="border border-slate-200 max-h-44 overflow-y-auto">
                    {dbResults.map(name => (
                      <button
                        key={name}
                        onClick={() => setDbSelected(name === dbSelected ? null : name)}
                        className={`w-full text-left text-xs px-3 py-2 border-b border-slate-100 last:border-b-0 transition-colors ${
                          dbSelected === name
                            ? 'bg-blue-700 text-white font-bold'
                            : 'hover:bg-blue-50 text-slate-800'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}

                {dbSearch && !dbLoading && dbResults.length === 0 && !dbError && (
                  <p className="text-[10px] text-slate-400 text-center py-2">Tidak ada hasil ditemukan.</p>
                )}

                {dbError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-[10px] px-3 py-2 leading-relaxed">
                    {dbError}
                  </div>
                )}

                {/* Load button */}
                <button
                  onClick={handleLoadDbGeometry}
                  disabled={!dbSelected || dbLoading}
                  className="w-full text-xs font-bold py-2.5 px-3 rounded-none bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                >
                  {dbLoading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat…</>
                    : <><CheckCircle className="w-3.5 h-3.5" /> Muat Geometri{dbSelected ? `: ${dbSelected}` : ''}</>
                  }
                </button>

              </div>
            </div>

            {/* ── DEMO PRESETS (collapsible) ── */}
            <div className="border border-slate-200 rounded-none">
              <button
                onClick={() => setShowDemoPresets(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> Contoh Prasetel Bawaan
                </span>
                {showDemoPresets ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {showDemoPresets && (
                <div className="border-t border-slate-200 p-4 space-y-3">
                  {INDONESIAN_PRESETS.map((preset) => (
                    <div
                      key={preset.id}
                      className="p-3 bg-slate-50 border border-slate-200 hover:border-blue-400 rounded-none transition-all"
                    >
                      <p className="text-xs font-bold text-slate-900 mb-1 flex items-center justify-between">
                        <span>{preset.name}</span>
                        <span className="text-[9px] font-bold text-blue-700 bg-white border border-blue-200 px-1.5 py-0.5">
                          {preset.cityName}
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-500 mb-3 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                      <button
                        onClick={() => onLoadPreset(preset.id)}
                        className="w-full text-[10px] font-bold py-2 px-3 rounded-none bg-slate-700 text-white hover:bg-slate-900 transition-colors flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                      >
                        <CheckCircle className="w-3 h-3" /> Muat Prasetel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: DATA IMPORT AND WORKSPACE STYLING */}
        {activeTab === 'data' && (
          <div className="space-y-5 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold tracking-wider text-slate-500 uppercase mb-2">
                Unggah Berkas Geospasial
              </label>
              
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-700 bg-slate-50 hover:bg-blue-50/10 p-6 rounded-none flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-700 transition-colors" />
                <p className="text-sm font-semibold text-slate-800">Klik/Seret Berkas ke Sini</p>
                <p className="text-[10px] text-slate-500 text-center uppercase tracking-wide leading-relaxed">
                  Mendukung format GPKG (.gpkg), GeoJSON (.geojson), KML (.kml)
                </p>
                {uploading && (
                  <p className="text-[11px] text-blue-700 font-bold tracking-wider animate-pulse mt-2 uppercase">
                    Mengekstrak Layer Basis Data...
                  </p>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".gpkg,.geojson,.json,.kml"
                className="hidden"
              />
            </div>

            {/* Manual coordinate boundary adjuster */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-none space-y-3">
              <span className="text-xs font-bold tracking-wider text-slate-800 uppercase flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-700" /> Atur Batas Koordinat Bounding
              </span>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-slate-500 block mb-1">Bujur Barat (Min Lng)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={manualMinLng}
                    onChange={(e) => setManualMinLng(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 focus:border-blue-700 focus:outline-none text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Bujur Timur (Max Lng)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={manualMaxLng}
                    onChange={(e) => setManualMaxLng(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 focus:border-blue-700 focus:outline-none text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Lintang Selatan (Min Lat)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={manualMinLat}
                    onChange={(e) => setManualMinLat(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 focus:border-blue-700 focus:outline-none text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Lintang Utara (Max Lat)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={manualMaxLat}
                    onChange={(e) => setManualMaxLat(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 focus:border-blue-700 focus:outline-none text-slate-900"
                  />
                </div>
              </div>
              <button
                onClick={handleApplyBounds}
                className="w-full text-xs font-bold py-2.5 px-3 rounded-none bg-blue-700 text-white hover:bg-blue-800 transition-colors pointer-events-auto cursor-pointer uppercase tracking-wider"
              >
                Terapkan Batas Wilayah Baru
              </button>
            </div>

            {/* List of active spatial GIS layers */}
            <div className="space-y-3">
              <label className="block text-xs font-bold tracking-wider text-slate-700 uppercase">
                Layer Spasial Terpasang ({layers.length})
              </label>

              {layers.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Belum ada layer spasial. Unggah berkas atau pilih contoh di tab Prasetel.</p>
              ) : (
                <div className="space-y-3">
                  {layers.map((layer) => (
                    <div
                      key={layer.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-none space-y-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateLayerStyles(layer.id, { visible: !layer.visible })}
                            className="text-slate-600 hover:text-blue-700 transition-colors"
                          >
                            {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <span className="text-xs font-bold text-slate-850 font-sans truncate max-w-[180px]">
                            {layer.name}
                          </span>
                        </div>
                        <button
                          onClick={() => removeLayer(layer.id)}
                          className="text-slate-500 hover:text-red-650 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Styling controllers */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-slate-500 block mb-1">Warna Isi (Poligon)</label>
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="color"
                              value={layer.color}
                              onChange={(e) => updateLayerStyles(layer.id, { color: e.target.value })}
                              className="w-6 h-6 border-0 p-0 rounded-sm cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-slate-600">{layer.color}</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-slate-500 block mb-1">Warna Batas (Garis)</label>
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="color"
                              value={layer.strokeColor}
                              onChange={(e) => updateLayerStyles(layer.id, { strokeColor: e.target.value })}
                              className="w-6 h-6 border-0 p-0 rounded-sm cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-slate-600">{layer.strokeColor}</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-slate-500 block mb-1">Ketebalan Garis ({layer.strokeWidth}px)</label>
                          <input
                            type="range"
                            min="0.5"
                            max="8"
                            step="0.5"
                            value={layer.strokeWidth}
                            onChange={(e) => updateLayerStyles(layer.id, { strokeWidth: parseFloat(e.target.value) })}
                            className="w-full accent-blue-700 h-1 rounded-none appearance-none cursor-pointer bg-slate-200"
                          />
                        </div>

                        <div>
                          <label className="text-slate-500 block mb-1">Opasitas Isi ({Math.round(layer.fillOpacity * 100)}%)</label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={layer.fillOpacity}
                            onChange={(e) => updateLayerStyles(layer.id, { fillOpacity: parseFloat(e.target.value) })}
                            className="w-full accent-blue-700 h-1 rounded-none appearance-none cursor-pointer bg-slate-200"
                          />
                        </div>
                      </div>

                      {/* Choropleth fields helper */}
                      {layer.features[0]?.properties && Object.keys(layer.features[0].properties).length > 0 && (
                        <div className="border-t border-slate-200 pt-2 space-y-1.5">
                          <label className="text-slate-500 text-xs block">Styling Choropleth Tematik</label>
                          <div className="flex gap-2">
                            <select
                              value={layer.categoryField || ''}
                              onChange={(e) => {
                                if (e.target.value) applyUniqueCategoryStyling(layer.id, e.target.value);
                                else clearUniqueCategoryStyling(layer.id);
                              }}
                              className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1 text-xs text-slate-800"
                            >
                              <option value="">Warna Tunggal (Klasik)</option>
                              {Object.keys(layer.features[0].properties).map(field => (
                                <option key={field} value={field}>Choropleth: {field}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PUBLICATION LAYOUT, GRIDLINES AND SCALES */}
        {activeTab === 'layout' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Template select */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold tracking-wider text-slate-700 uppercase">
                Rasio Dimensi Kertas Publikasi
              </label>
              <select
                value={settings.layoutTemplate}
                onChange={(e) => {
                  const val = e.target.value as LayoutTemplate;
                  onUpdateSettings({
                    layoutTemplate: val,
                    margin: val === 'JOURNAL_SINGLE' ? 30 : 60,
                  });
                }}
                className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-2 text-xs text-slate-800"
              >
                {Object.entries(LAYOUT_TEMPLATES).map(([key, item]) => (
                  <option key={key} value={key}>{item.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 font-sans tracking-wide leading-relaxed">
                Tata letak map plot area dikonfigurasi mengikuti kaidah cetak standar jurnal akademik internasional.
              </p>
            </div>

            {/* Custom colors */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold tracking-wider text-slate-700 uppercase">
                Tema Kartografis Naskah Jurnal
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(COLOR_PRESETS).map(([id, info]) => (
                  <button
                    key={id}
                    onClick={() => onUpdateSettings({ theme: id as ColorTheme })}
                    className={`p-2 rounded-none border text-[10px] font-bold tracking-wide uppercase text-left transition-all cursor-pointer ${
                      settings.theme === id
                        ? 'border-blue-700 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {info.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Coordinate graticules adjustments */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-none space-y-4 shadow-sm">
              <span className="text-xs font-bold tracking-wider text-slate-800 uppercase flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-700" /> Garis Kisi Koordinat (Graticule)
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-500 block mb-1">Tampilkan Grid</label>
                  <select
                    value={settings.showGraticule ? 'yes' : 'no'}
                    onChange={(e) => onUpdateSettings({ showGraticule: e.target.value === 'yes' })}
                    className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 text-slate-800"
                  >
                    <option value="yes">Aktif</option>
                    <option value="no">Non-Aktif</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-500 block mb-1">Model Notasi</label>
                  <select
                    value={settings.gridAnnotationFormat}
                    onChange={(e) => onUpdateSettings({ gridAnnotationFormat: e.target.value as 'DMS' | 'Decimal' })}
                    className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 text-slate-800"
                  >
                    <option value="DMS">DMS (106° 45' S)</option>
                    <option value="Decimal">Desimal (-6.185°)</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-slate-500 block mb-1">Rapat Spasi Grid (Derajat): {settings.graticuleStep}°</label>
                  <input
                    type="range"
                    min="0.001"
                    max="1"
                    step="0.001"
                    value={settings.graticuleStep}
                    onChange={(e) => onUpdateSettings({ graticuleStep: parseFloat(e.target.value) })}
                    className="w-full accent-blue-700 h-1 rounded-none appearance-none cursor-pointer bg-slate-200"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1 leading-relaxed">Gunakan angka kecil untuk wilayah sempit, angka besar untuk wilayah luas.</span>
                </div>
              </div>
            </div>

            {/* Scale adjustment and compass */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-none space-y-4 shadow-sm">
              <span className="text-xs font-bold tracking-wider text-slate-800 uppercase flex items-center gap-1.5">
                <CompassIcon className="w-3.5 h-3.5 text-blue-700" /> Skala Bar & Arah Utara
              </span>

              <div className="space-y-3 text-xs">
                {/* Scale item toggle */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-slate-700">
                  <span>Tampilkan Skala Bar</span>
                  <input
                    type="checkbox"
                    checked={settings.showScaleBar}
                    onChange={(e) => onUpdateSettings({ showScaleBar: e.target.checked })}
                    className="accent-blue-700 cursor-pointer"
                  />
                </div>

                {settings.showScaleBar && (() => {
                  const layoutDims = LAYOUTS[settings.layoutTemplate] || LAYOUTS.A4_LANDSCAPE;
                  const currentScaleStr = calculateRepresentativeScale(bounds, layoutDims.width, layoutDims.height, settings);
                  return (
                    <div className="space-y-2 mb-3">
                      <div className="grid grid-cols-2 gap-2 pl-3 border-l-2 border-slate-250">
                        <div>
                          <label className="text-slate-500 block mb-1">Lebar Skala</label>
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            value={settings.scaleBarLengthKm}
                            onChange={(e) => onUpdateSettings({ scaleBarLengthKm: parseInt(e.target.value) || 1 })}
                            className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 text-xs text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 block mb-1">Satuan</label>
                          <select
                            value={settings.scaleBarUnit}
                            onChange={(e) => onUpdateSettings({ scaleBarUnit: e.target.value as 'km' | 'm' })}
                            className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 text-xs text-slate-800"
                          >
                            <option value="km">Kilometer (km)</option>
                            <option value="m">Meter (m)</option>
                          </select>
                        </div>
                      </div>
                      <div className="pl-3 border-l-2 border-slate-250 text-[10px] text-slate-600 bg-slate-150/40 p-2 border border-slate-200/50 flex items-center justify-between">
                        <span className="font-semibold text-slate-500">Estimasi Rasi Skala Peta:</span>
                        <span className="font-mono font-bold text-blue-700 text-[11px]">{currentScaleStr}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Compass show toggle */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-slate-700">
                  <span>Tampilkan Kompas Arah Utara</span>
                  <input
                    type="checkbox"
                    checked={settings.showNorthArrow}
                    onChange={(e) => onUpdateSettings({ showNorthArrow: e.target.checked })}
                    className="accent-blue-700 cursor-pointer"
                  />
                </div>

                {settings.showNorthArrow && (
                  <div className="grid grid-cols-2 gap-2 pl-3 border-l-2 border-slate-250 space-y-1">
                    <div className="col-span-2">
                      <label className="text-slate-500 block mb-1">Model Kompas</label>
                      <select
                        value={settings.northArrowStyle}
                        onChange={(e) => onUpdateSettings({ northArrowStyle: e.target.value as 'classic' | 'modern' | 'minimal' })}
                        className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 text-xs text-slate-850"
                      >
                        <option value="classic">Klasik Eksklusif (Kubah Gelap)</option>
                        <option value="modern">Modern Bulat Kemudi</option>
                        <option value="minimal">Minimalis Garis Tali</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1">Ukuran Kompas ({settings.northArrowScale}x)</label>
                      <input
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.1"
                        value={settings.northArrowScale}
                        onChange={(e) => onUpdateSettings({ northArrowScale: parseFloat(e.target.value) })}
                        className="w-full accent-blue-700 h-1 appearance-none cursor-pointer bg-slate-200"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Margins and clean elements */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-none text-xs space-y-3 shadow-sm">
              <span className="text-xs font-bold tracking-wider text-slate-800 uppercase block">
                Teks Informasi & Judul
              </span>
              
              <div className="flex items-center justify-between mb-2 text-slate-700">
                <span>Tampilkan Judul Peta Utama</span>
                <input
                  type="checkbox"
                  checked={settings.showTitle}
                  onChange={(e) => onUpdateSettings({ showTitle: e.target.checked })}
                  className="accent-blue-700 cursor-pointer"
                  id="checkbox-show-title"
                />
              </div>

              {settings.showTitle && (
                <div className="space-y-2 pl-3 border-l-2 border-slate-250">
                  <div>
                    <label className="text-slate-500 block mb-1">Judul Peta (Kapital)</label>
                    <input
                      type="text"
                      value={settings.title}
                      onChange={(e) => onUpdateSettings({ title: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 focus:border-blue-700 focus:outline-none text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Subtitle Keterangan</label>
                    <input
                      type="text"
                      value={settings.subtitle}
                      onChange={(e) => onUpdateSettings({ subtitle: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 focus:border-blue-700 focus:outline-none text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-250 pt-2 text-slate-700">
                <span>Sembunyikan Informasi Universitas</span>
                <input
                  type="checkbox"
                  checked={settings.publicationNoCredit}
                  onChange={(e) => onUpdateSettings({ publicationNoCredit: e.target.checked })}
                  className="accent-blue-700 cursor-pointer"
                />
              </div>
            </div>

            {/* Tata Letak Publikasi Ilmuwan (Professional Multi-Panel Sidebar) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-none space-y-4 shadow-sm">
              <span className="text-xs font-bold tracking-wider text-slate-800 uppercase flex items-center gap-1.5 font-bold uppercase text-[11px]">
                <Layout className="w-3.5 h-3.5 text-blue-700" /> Tata Letak Kolom Kiri Kanan
              </span>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-slate-700">
                  <div className="flex flex-col pr-2">
                    <span className="font-semibold text-slate-800">Gunakan Kolom Informasi Kanan</span>
                    <span className="text-[10px] text-slate-500 mt-0.5 leading-normal">Kumpulkan Judul, Kompas, Skala, Legenda, & Sumber Data rapi di kolom kanan terpisah (gaya publikasi ilmiah).</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.layoutPeripheralPanel}
                    onChange={(e) => onUpdateSettings({ layoutPeripheralPanel: e.target.checked })}
                    className="accent-blue-700 cursor-pointer w-4 h-4 shrink-0"
                  />
                </div>

                {settings.layoutPeripheralPanel && (
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <label className="text-slate-500 block mb-1 font-semibold">Sumber Data Peta (Map Data Source)</label>
                    <input
                      type="text"
                      value={settings.mapDataSource || ''}
                      onChange={(e) => onUpdateSettings({ mapDataSource: e.target.value })}
                      placeholder="Contoh: BIG RI, BPS Sleman 2026"
                      className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 focus:border-blue-700 focus:outline-none text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                      Sumber data ini akan dicetak di bagian paling bawah barisan kolom kanan.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Pengaturan Legenda Peta Khusus */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-none space-y-4 shadow-sm">
              <span className="text-xs font-bold tracking-wider text-slate-800 uppercase flex items-center gap-1.5 font-bold uppercase text-[11px]">
                <List className="w-3.5 h-3.5 text-blue-700" /> Kustomisasi Legenda Peta
              </span>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-slate-700">
                  <span>Tampilkan Legenda Peta</span>
                  <input
                    type="checkbox"
                    checked={settings.showLegend}
                    onChange={(e) => onUpdateSettings({ showLegend: e.target.checked })}
                    className="accent-blue-700 cursor-pointer w-4 h-4"
                  />
                </div>

                {settings.showLegend && (
                  <div className="space-y-3 pl-3 border-l-2 border-slate-250">
                    <div>
                      <label className="text-slate-500 block mb-1">Judul Legenda Peta</label>
                      <input
                        type="text"
                        value={settings.legendTitle || ''}
                        onChange={(e) => onUpdateSettings({ legendTitle: e.target.value })}
                        placeholder="LEGENDA PETA"
                        className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 focus:border-blue-700 focus:outline-none text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-slate-500 block mb-1">Model Bentuk Legenda</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ legendType: 'discrete' })}
                          className={`px-2 py-1.5 border text-center font-semibold text-[11px] cursor-pointer transition ${
                            settings.legendType === 'discrete'
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Diskrit / Unik
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ legendType: 'choropleth' })}
                          className={`px-2 py-1.5 border text-center font-semibold text-[11px] cursor-pointer transition ${
                            settings.legendType === 'choropleth'
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Choropleth Gradasi
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                        Kategori diskrit menampilkan kotak unik untuk setiap klasifikasi; gradasi menampilkan blok baris meler/mengalir secara horizontal.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Basemap Options */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-none space-y-4 shadow-sm">
              <span className="text-xs font-bold tracking-wider text-slate-800 uppercase flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-700" /> Peta Dasar (Basemap)
              </span>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-slate-700">
                  <span className="font-semibold">Aktifkan Layanan Peta Dasar</span>
                  <input
                    type="checkbox"
                    checked={settings.showBasemap}
                    onChange={(e) => onUpdateSettings({ showBasemap: e.target.checked })}
                    className="accent-blue-700 cursor-pointer w-4 h-4"
                    id="checkbox-show-basemap"
                  />
                </div>

                {settings.showBasemap && (
                  <div className="space-y-3 pl-3 border-l-2 border-slate-250">
                    <div>
                      <label className="text-slate-500 block mb-1">Pilih Provider Basemap</label>
                      <select
                        value={settings.basemapProvider || 'hillshade'}
                        onChange={(e) => onUpdateSettings({ basemapProvider: e.target.value as any })}
                        className="w-full bg-white border border-slate-200 rounded-none px-2 py-1.5 focus:border-blue-700 focus:outline-none text-slate-900 cursor-pointer"
                      >
                        <option value="hillshade">Hillshade SRTM (Esri Elevation)</option>
                        <option value="imagery">Citra Satelit (Esri World Imagery)</option>
                        <option value="opentopo">OpenTopoMap (Sanjali & Kontur)</option>
                        <option value="terrain">Shaded Relief (Esri Terrain)</option>
                        <option value="osm">OpenStreetMap Standard</option>
                      </select>
                      <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                        {settings.basemapProvider === 'imagery' 
                          ? 'Citra Satelit resolusi tinggi global dari kontribusi berbagai sensor satelit komersial dan udara.'
                          : 'Hillshade SRTM menampilkan bayangan relief topografi bumi 3D grayscale dari DEM tingkat global.'
                        }
                      </span>
                    </div>

                    <div>
                      <label className="text-slate-500 block mb-1">Transparansi Basemap ({Math.round(settings.basemapOpacity * 100)}%)</label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={settings.basemapOpacity}
                        onChange={(e) => onUpdateSettings({ basemapOpacity: parseFloat(e.target.value) })}
                        className="w-full accent-blue-700 h-1 appearance-none cursor-pointer bg-slate-200"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Inset Map Locator Option */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-none space-y-4 shadow-sm">
              <span className="text-xs font-bold tracking-wider text-slate-800 uppercase flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-700" /> Diagram Lokasi (Inset Map)
              </span>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-slate-700">
                  <span>Tampilkan Inset Map</span>
                  <input
                    type="checkbox"
                    checked={settings.showInsetMap}
                    onChange={(e) => onUpdateSettings({ showInsetMap: e.target.checked })}
                    className="accent-blue-700 cursor-pointer"
                    id="checkbox-show-inset"
                  />
                </div>

                {settings.showInsetMap && (
                  <div className="space-y-3 pl-3 border-l-2 border-slate-250">
                    <div>
                      <label className="text-slate-500 block mb-1">Posisi Sudut Map</label>
                      <select
                        value={settings.insetMapPosition ?? 'bottom-right'}
                        onChange={(e) => onUpdateSettings({ insetMapPosition: e.target.value as any })}
                        className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-700"
                      >
                        <option value="top-left">Kiri Atas (Top-Left)</option>
                        <option value="top-right">Kanan Atas (Top-Right)</option>
                        <option value="bottom-left">Kiri Bawah (Bottom-Left)</option>
                        <option value="bottom-right">Kanan Bawah (Bottom-Right)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-500 block mb-1">Rasio Luas Wilayah Sekitar ({settings.insetMapScale}x)</label>
                      <input
                        type="range"
                        min="3"
                        max="20"
                        step="0.5"
                        value={settings.insetMapScale}
                        onChange={(e) => onUpdateSettings({ insetMapScale: parseFloat(e.target.value) })}
                        className="w-full accent-blue-700 h-1 appearance-none cursor-pointer bg-slate-200"
                      />
                      <p className="text-[9px] text-slate-500 mt-1">Mengontrol seberapa luas wilayah regional di sekitar peta utama yang dimunculkan pada inset.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: LABELS ANNOTATION SYSTEM */}
        {activeTab === 'labels' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Custom village label creator */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-none space-y-4 shadow-sm">
              <span className="text-xs font-bold tracking-wider text-slate-800 uppercase flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-blue-700" /> Tambah Teks Anotasi Koordinat
              </span>
              
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-500 block mb-1">Isi Teks Label (Nama Desa, Gunung, Samudra)</label>
                  <input
                    type="text"
                    value={newLabelText}
                    onChange={(e) => setNewLabelText(e.target.value)}
                    placeholder="Contoh: Desa Suka Makmur"
                    className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 focus:border-blue-700 focus:outline-none text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-500 block mb-1">Ukuran Huruf (px)</label>
                    <input
                      type="number"
                      min="6"
                      max="32"
                      value={newLabelSize}
                      onChange={(e) => setNewLabelSize(parseInt(e.target.value) || 10)}
                      className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 focus:outline-none text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Ketebalan</label>
                    <select
                      value={newLabelWeight}
                      onChange={(e) => setNewLabelWeight(e.target.value as 'normal' | 'bold')}
                      className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 focus:outline-none text-slate-800"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Tebal (Bold)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Sudut Rotasi</label>
                    <input
                      type="number"
                      min="-360"
                      max="360"
                      value={newLabelAngle}
                      onChange={(e) => setNewLabelAngle(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 rounded-none px-2.5 py-1.5 focus:outline-none text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Warna</label>
                    <input
                      type="color"
                      value={newLabelColor || COLOR_PRESETS[settings.theme].text}
                      onChange={(e) => setNewLabelColor(e.target.value)}
                      className="w-full h-8 bg-transparent border-0 p-0 cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddLabel}
                  className="w-full text-xs font-bold py-2.5 px-3 rounded-none bg-blue-700 text-white hover:bg-blue-800 transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Sematkan ke Peta
                </button>
              </div>
            </div>

            {/* List of active editable labels */}
            <div className="space-y-2">
              <label className="block text-xs font-bold tracking-wider text-slate-700 uppercase">
                Daftar Teks Peta Aktif ({labels.length})
              </label>

              {labels.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Belum ada label teks ditambahkan.</p>
              ) : (
                <div className="max-h-[220px] overflow-y-auto border border-slate-200 rounded-none divide-y divide-slate-200">
                  {labels.map((lbl) => (
                    <div
                      key={lbl.id}
                      className="p-2.5 bg-slate-50 flex items-center justify-between text-xs transition-colors hover:bg-slate-100"
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-slate-800">{lbl.text}</span>
                        <p className="text-[10px] text-slate-500 font-mono">
                          lat: {lbl.lat?.toFixed(4)}, lng: {lbl.lng?.toFixed(4)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveLabel(lbl.id)}
                        className="text-slate-500 hover:text-red-650 transition-colors p-1 cursor-pointer"
                        title="Hapus Label"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: ACTIVE FEATURE DIALOG OR ATTRIBUTE TABLE */}
        {activeTab === 'feature' && (
          <div className="space-y-4 animate-fadeIn">
            {selectedFeature ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-blue-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-700" /> Detail Geodata Terpilih
                  </span>
                  <button
                    onClick={() => onSelectFeature(null)}
                    className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded-sm cursor-pointer font-bold"
                  >
                    Tutup
                  </button>
                </div>

                <div className="p-3 bg-slate-55 border border-slate-200 rounded-none space-y-1 shadow-sm">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-mono">Daftar Atribut Penelitian</span>
                  <p className="text-base font-bold text-slate-900 font-sans">
                    {selectedFeature.properties.name || selectedFeature.properties.KECAMATAN || selectedFeature.properties.DESA || `Fitur #${selectedFeature.id}`}
                  </p>
                </div>

                {/* Attribute Key Value details */}
                <div className="border border-slate-200 rounded-none overflow-hidden text-xs shadow-sm">
                  <div className="grid grid-cols-2 bg-slate-100 px-3 py-1.5 border-b border-slate-200 font-bold text-slate-650 uppercase tracking-wider text-[10px]">
                    <span>Atribut (Key)</span>
                    <span>Nilai Data (Value)</span>
                  </div>
                  <div className="divide-y divide-slate-150 font-sans max-h-[220px] overflow-auto bg-white">
                    {Object.entries(selectedFeature.properties).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-2 px-3 py-2 hover:bg-slate-50 transition-colors text-slate-800">
                        <span className="font-mono text-slate-550 pr-2 truncate text-[11px] font-semibold" title={key}>{key}</span>
                        <span className="text-slate-800 font-medium break-all">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-blue-50/50 border border-blue-150 rounded-none text-xs leading-relaxed text-slate-700 flex gap-2">
                  <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <span>
                    Gunakan kolom di atas sebagai panduan kategorisasi legenda naskah atau cetak PDF langsung untuk anotasi eksternal.
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 space-y-2">
                <Globe className="w-10 h-10 mx-auto text-slate-300 opacity-50" />
                <p className="text-xs italic leading-relaxed text-slate-500">
                  Belum ada wilayah (polygon) yang diklik.<br />
                  Klik ganda atau klik poligon pada peta untuk menampilkan data statistik detail tingkat kelurahan/kecamatan.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Button Drawer */}
      <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-3">
        <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider text-center">
          Pilihan Ekspor Cepat Peta
        </span>
        <div className="grid grid-cols-2 gap-2">
          {/* Choice 1: Unduh SVG */}
          <button
            onClick={() => {
              const svgElement = document.getElementById('cartography-publication-svg');
              if (!svgElement) return;

              // Serialize the styled vector SVG map XML string
              const serializer = new XMLSerializer();
              let source = serializer.serializeToString(svgElement);

              // Add namespaces if missing
              if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
                source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
              }

              // Construct standard safe blob downloading link
              const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
              const downloadLink = document.createElement('a');
              downloadLink.href = url;
              downloadLink.download = `peta_ilmiah_${Date.now()}.svg`;
              document.body.appendChild(downloadLink);
              downloadLink.click();
              document.body.removeChild(downloadLink);
            }}
            className="text-[11px] font-bold py-3 px-2 rounded-none bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
            title="Unduh Peta dalam Format Vektor (.svg) hancur-bebas"
          >
            <Compass className="w-3.5 h-3.5 text-blue-400" /> Format SVG
          </button>

          {/* Choice 2: Unduh / Simpan PDF */}
          <button
            onClick={async () => {
              if (isExportingPdf) return;
              setIsExportingPdf(true);
              try {
                const svgElement = document.getElementById('cartography-publication-svg');
                if (!svgElement) {
                  alert('Peta SVG tidak ditemukan.');
                  setIsExportingPdf(false);
                  return;
                }

                // Clone the SVG so we can manipulate it (converting external map URLs to inlined Base64) without disrupting the UI
                const svgClone = svgElement.cloneNode(true) as SVGElement;

                // Helper to fetch any cross-origin map tile or image and convert it into robust, inlined Base64 data URLs
                const convertUrlToBase64 = async (url: string): Promise<string> => {
                  try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error('Failed to fetch tile image resource');
                    const blob = await res.blob();
                    return new Promise((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onloadend = () => resolve(reader.result as string);
                      reader.onerror = reject;
                      reader.readAsDataURL(blob);
                    });
                  } catch (error) {
                    console.error('Error converting basemap URL to Base64:', url, error);
                    return url;
                  }
                };

                // Query and convert all tiles/images in the cloned layout in parallel
                const imageElements = Array.from(svgClone.querySelectorAll('image'));
                await Promise.all(
                  imageElements.map(async (imgEl) => {
                    const href = imgEl.getAttribute('href');
                    if (href && href.startsWith('http')) {
                      const base64 = await convertUrlToBase64(href);
                      imgEl.setAttribute('href', base64);
                    }
                  })
                );

                // Serialize the fully inlined vector SVG map XML string
                const serializer = new XMLSerializer();
                let source = serializer.serializeToString(svgClone);

                // Add namespaces if missing
                if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
                  source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
                }

                const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);

                const activeLayout = LAYOUTS[settings.layoutTemplate] || LAYOUTS.CUSTOM;
                const w = activeLayout.width;
                const h = activeLayout.height;

                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    // 3.5x scale yields ultra-sharp print output
                    const scale = 3.5;
                    canvas.width = w * scale;
                    canvas.height = h * scale;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                      setIsExportingPdf(false);
                      URL.revokeObjectURL(url);
                      return;
                    }

                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    const imgData = canvas.toDataURL('image/jpeg', 0.98);

                    // Dynamic load jsPDF to trigger precise file download
                    import('jspdf').then(({ jsPDF }) => {
                      const orientation = w > h ? 'l' : 'p';
                      const pdf = new jsPDF({
                        orientation: orientation,
                        unit: 'px',
                        format: [w, h]
                      });

                      pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
                      pdf.save(`peta_ilmiah_${Date.now()}.pdf`);
                      setIsExportingPdf(false);
                      URL.revokeObjectURL(url);
                    }).catch(err => {
                      console.error('Failed to load jsPDF:', err);
                      setIsExportingPdf(false);
                      URL.revokeObjectURL(url);
                    });
                  } catch (e) {
                    console.error('Error drawing canvas:', e);
                    setIsExportingPdf(false);
                    URL.revokeObjectURL(url);
                  }
                };
                img.onerror = () => {
                  setIsExportingPdf(false);
                  URL.revokeObjectURL(url);
                };
                img.src = url;
              } catch (e) {
                console.error(e);
                setIsExportingPdf(false);
              }
            }}
            disabled={isExportingPdf}
            className={`text-[11px] font-bold py-3 px-2 rounded-none transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider ${
              isExportingPdf ? 'bg-slate-400 text-slate-700 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800 text-white'
            }`}
            title="Unduh Peta dalam Format PDF Resolusi Tinggi untuk Dicetak"
          >
            <Printer className={`w-3.5 h-3.5 ${isExportingPdf ? 'animate-pulse' : 'text-white'}`} />
            {isExportingPdf ? 'Membuat...' : 'Format PDF'}
          </button>
        </div>
        <span className="text-[10px] text-slate-500 block text-center uppercase tracking-wide leading-relaxed">
          SVG siap diolah di Inkscape/Illustrator, atau simpan ke PDF untuk langsung dicetak secara utuh.
        </span>
      </div>
    </div>
  );
}
