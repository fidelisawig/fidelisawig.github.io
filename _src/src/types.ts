/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';

export interface MapFeature {
  id: string | number;
  type: 'Feature';
  geometry: any;
  properties: Record<string, any>;
  layerId: string;
}

export interface MapLayer {
  id: string;
  name: string;
  features: MapFeature[];
  visible: boolean;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  fillOpacity: number;
  categoryField?: string;
  categoriesColorMap?: Record<string, string>;
}

export type LayoutTemplate = 'A4_LANDSCAPE' | 'A4_PORTRAIT' | 'JOURNAL_DOUBLE' | 'JOURNAL_SINGLE' | 'CUSTOM';

export interface LayoutDimensions {
  width: number; // in pixels or arbitrary ratio
  height: number;
  label: string;
  desc: string;
}

export const LAYOUTS: Record<LayoutTemplate, LayoutDimensions> = {
  A4_LANDSCAPE: { width: 1120, height: 790, label: 'A4 Landscape (Mendatar)', desc: 'Cocok untuk wilayah membentang horizontal' },
  A4_PORTRAIT: { width: 790, height: 1120, label: 'A4 Portrait (Tegak)', desc: 'Cocok untuk wilayah memanjang vertikal' },
  JOURNAL_DOUBLE: { width: 850, height: 600, label: 'Jurnal Dual-Kolom (17 cm)', desc: 'Format lebar penuh standar publikasi' },
  JOURNAL_SINGLE: { width: 420, height: 420, label: 'Jurnal Satu-Kolom (8.5 cm)', desc: 'Satu kolom jurnal berbentuk persegi kompak' },
  CUSTOM: { width: 800, height: 800, label: 'Kustom (Bebas/Persegi)', desc: 'Dimensi rasio kustom yang dapat diatur bebas' },
};

export type ColorTheme = 'grayscale' | 'academic_blue' | 'terrain' | 'warm_desert' | 'pastel' | 'monochrome_high';

export interface ColorSchemePreset {
  id: ColorTheme;
  name: string;
  bg: string;
  borderBg: string; // Background of outer map layout frame
  stroke: string;
  text: string;
  grid: string;
  palette: string[];
}

export const COLOR_PRESETS: Record<ColorTheme, ColorSchemePreset> = {
  grayscale: {
    id: 'grayscale',
    name: 'Grayscale Akademik (Standar)',
    bg: '#fbfbfb',
    borderBg: '#f3f4f6',
    stroke: '#4b5563',
    text: '#111827',
    grid: '#e5e7eb',
    palette: ['#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280', '#4b5563'],
  },
  monochrome_high: {
    id: 'monochrome_high',
    name: 'Hitam Putih Kontras Tinggi',
    bg: '#ffffff',
    borderBg: '#ffffff',
    stroke: '#000000',
    text: '#000000',
    grid: '#cbd5e1',
    palette: ['#ffffff', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b'],
  },
  academic_blue: {
    id: 'academic_blue',
    name: 'Biru Kartografis Klasik',
    bg: '#f0f7ff',
    borderBg: '#f8fafc',
    stroke: '#1e3a8a',
    text: '#0f172a',
    grid: '#e0f2fe',
    palette: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8'],
  },
  terrain: {
    id: 'terrain',
    name: 'Geografi Alam (Hijau-Cokelat)',
    bg: '#f4fbf7',
    borderBg: '#f8fafc',
    stroke: '#065f46',
    text: '#062f21',
    grid: '#e6f4ea',
    palette: ['#edfcf2', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#059669', '#047857'],
  },
  warm_desert: {
    id: 'warm_desert',
    name: 'Sand/Clay (Arid-Warm)',
    bg: '#fffdf9',
    borderBg: '#fafaf9',
    stroke: '#78350f',
    text: '#451a03',
    grid: '#fef3c7',
    palette: ['#fefaf0', '#fef3c7', '#fde68a', '#f59e0b', '#d97706', '#b45309', '#78350f'],
  },
  pastel: {
    id: 'pastel',
    name: 'Palet Pastel Soft (Elegis)',
    bg: '#fafaf9',
    borderBg: '#f5f5f4',
    stroke: '#404040',
    text: '#1c1917',
    grid: '#e7e5e4',
    palette: ['#fce7f3', '#f3e8ff', '#e0f2fe', '#ccfbf1', '#fef3c7', '#fee2e2'],
  },
};

export interface MapLabel {
  id: string;
  text: string;
  x: number; // Percent of map plot width (0-100) or geocoordinate projection? 
  y: number; // Percent of map plot height (0-100)
  lat?: number; // Actual coordinate for anchoring
  lng?: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
  angle: number; // Rotation degree
  isUserAdded?: boolean;
}

export interface MapSettings {
  title: string;
  subtitle: string;
  showTitle: boolean;
  showSubtitle: boolean;
  showGraticule: boolean;
  graticuleStep: number; // Step size in degrees, e.g. 0.05, 0.1, 0.5
  graticuleStyle: 'solid' | 'dashed' | 'dotted';
  showScaleBar: boolean;
  scaleBarLengthKm: number; // Length in km
  scaleBarUnit: 'km' | 'm';
  scaleBarPosition: { x: number; y: number }; // Percent of layout (0-100)
  showLegend: boolean;
  legendTitle: string;
  legendPosition: { x: number; y: number };
  showNorthArrow: boolean;
  northArrowPosition: { x: number; y: number };
  northArrowScale: number;
  northArrowStyle: 'classic' | 'modern' | 'minimal';
  theme: ColorTheme;
  margin: number; // Layout padding margins in px
  gridAnnotationFormat: 'DMS' | 'Decimal'; // Degree-Minute-Second vs Decimal Degree
  publicationNoCredit: boolean; // Hide watermarks for publication compliance
  projection: 'Mercator' | 'Equirectangular';
  coordinateLang: 'ID' | 'EN'; // Indonesian titles e.g. "BUJUR", "LINTANG" vs "LONGITUDE", "LATITUDE"
  layoutTemplate: LayoutTemplate;
  showBasemap: boolean;
  basemapOpacity: number;
  basemapProvider: 'osm' | 'hillshade' | 'opentopo' | 'terrain' | 'imagery';
  showInsetMap: boolean;
  insetMapPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  insetMapScale: number; // custom regional scale factor, e.g. 5 means 5 times larger bounding box
  layoutPeripheralPanel: boolean; // separate vertical right metadata box layout
  mapDataSource: string; // custom data source string (Sumber Data)
  legendType: 'discrete' | 'choropleth'; // unique/discrete categories legend vs continuous gradient legend
}

export interface GeographicBounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}
