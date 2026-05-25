/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MapLayer, MapSettings, MapLabel, GeographicBounds, LAYOUTS, LayoutTemplate } from './types';
import Sidebar from './components/Sidebar';
import MapCanvas from './components/MapCanvas';
import { INDONESIAN_PRESETS } from './components/IndonesianPresets';
import { Globe, Printer, BookOpen, Layers, CheckCircle, MapPin, ZoomIn, ZoomOut, Maximize, Info, Download, X, Compass, Image as ImageIcon } from 'lucide-react';

export default function App() {
  // Get default preset to initialize the workspace with premium state
  const initialPreset = INDONESIAN_PRESETS[0]; // Jakarta Pusat
  
  const [layers, setLayers] = useState<MapLayer[]>(initialPreset.layers);
  const [bounds, setBounds] = useState<GeographicBounds>({
    minLng: 106.775,
    maxLng: 106.875,
    minLat: -6.225,
    maxLat: -6.135,
  });

  const [settings, setSettings] = useState<MapSettings>({
    title: 'PETA KEPADATAN PENDUDUK KECAMATAN JAKARTA PUSAT',
    subtitle: 'Analisis Zonasi Spasial Tingkat Administratif di Provinsi DKI Jakarta',
    showTitle: true,
    showSubtitle: true,
    showGraticule: true,
    graticuleStep: 0.02,
    graticuleStyle: 'solid',
    showScaleBar: true,
    scaleBarLengthKm: 2,
    scaleBarUnit: 'km',
    scaleBarPosition: { x: 8, y: 85 },
    showLegend: true,
    legendTitle: 'Kepadatan Penduduk',
    legendPosition: { x: 70, y: 55 },
    showNorthArrow: true,
    northArrowPosition: { x: 88, y: 12 },
    northArrowScale: 1.2,
    northArrowStyle: 'classic',
    theme: 'academic_blue',
    margin: 60,
    gridAnnotationFormat: 'DMS',
    publicationNoCredit: false,
    projection: 'Mercator',
    coordinateLang: 'ID',
    layoutTemplate: 'A4_LANDSCAPE',
    showBasemap: true,
    basemapOpacity: 0.65,
    basemapProvider: 'hillshade',
    showInsetMap: false,
    insetMapPosition: 'bottom-right',
    insetMapScale: 8.0,
    layoutPeripheralPanel: false,
    mapDataSource: 'Hasil Analisis Spasial & DEMnas, 2026',
    legendType: 'discrete',
  });

  // Default labels to label DKI Jakarta districts automatically
  const [labels, setLabels] = useState<MapLabel[]>([
    {
      id: 'lbl_gambir',
      text: 'GAMBIR',
      x: 35,
      y: 35,
      lat: -6.173,
      lng: 106.812,
      fontSize: 8,
      fontWeight: 'bold',
      color: '#1e293b',
      angle: 0,
    },
    {
      id: 'lbl_menteng',
      text: 'MENTENG',
      x: 55,
      y: 65,
      lat: -6.198,
      lng: 106.831,
      fontSize: 8,
      fontWeight: 'bold',
      color: '#1e293b',
      angle: 0,
    },
    {
      id: 'lbl_tanahabang',
      text: 'TANAH ABANG',
      x: 20,
      y: 68,
      lat: -6.195,
      lng: 106.802,
      fontSize: 8,
      fontWeight: 'bold',
      color: '#1e293b',
      angle: -15,
    },
    {
      id: 'lbl_senen',
      text: 'SENEN',
      x: 75,
      y: 48,
      lat: -6.192,
      lng: 106.845,
      fontSize: 8,
      fontWeight: 'bold',
      color: '#1e293b',
      angle: 10,
    },
  ]);

  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Layout selection ratios mapping
  const getLayoutDimensions = () => {
    return LAYOUTS[settings.layoutTemplate] || LAYOUTS.A4_LANDSCAPE;
  };

  const layout = getLayoutDimensions();

  // Load preset handler to update map states
  const handleLoadPreset = (presetId: string) => {
    const preset = INDONESIAN_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    setLayers(preset.layers);
    setSelectedFeature(null);

    // Compute bounds and scale steps
    if (preset.id === 'jakarta_pusat') {
      setBounds({
        minLng: 106.775,
        maxLng: 106.875,
        minLat: -6.225,
        maxLat: -6.135,
      });
      setSettings(prev => ({
        ...prev,
        title: 'PETA KEPADATAN PENDUDUK KECAMATAN JAKARTA PUSAT',
        subtitle: 'Analisis Zonasi Spasial Tingkat Administratif di Provinsi DKI Jakarta',
        graticuleStep: 0.02,
        scaleBarLengthKm: 2,
        legendTitle: 'Kepadatan Penduduk',
      }));
      setLabels([
        { id: 'lbl_gambir', text: 'GAMBIR', x: 35, y: 35, lat: -6.173, lng: 106.812, fontSize: 8, fontWeight: 'bold', color: '#10172a', angle: 0 },
        { id: 'lbl_menteng', text: 'MENTENG', x: 55, y: 65, lat: -6.198, lng: 106.831, fontSize: 8, fontWeight: 'bold', color: '#10172a', angle: 0 },
        { id: 'lbl_tanahabang', text: 'TANAH ABANG', x: 20, y: 68, lat: -6.195, lng: 106.802, fontSize: 8, fontWeight: 'bold', color: '#10172a', angle: -15 },
        { id: 'lbl_senen', text: 'SENEN', x: 75, y: 48, lat: -6.192, lng: 106.845, fontSize: 8, fontWeight: 'bold', color: '#10172a', angle: 10 },
      ]);
    } else if (preset.id === 'yogyakarta_sleman') {
      setBounds({
        minLng: 110.35,
        maxLng: 110.41,
        minLat: -7.825,
        maxLat: -7.745,
      });
      setSettings(prev => ({
        ...prev,
        title: 'PETA TEMATIK ZONA BUDAYA MAHASISWA YOGYAKARTA',
        subtitle: 'Zonasi Spasial Cagar Budaya Kraton, Pedestrian Malioboro, & Kampus Sleman',
        graticuleStep: 0.01,
        scaleBarLengthKm: 1,
        legendTitle: 'Sektor Zonasi',
      }));
      setLabels([
        { id: 'lbl_kraton', text: 'ZONA KRATON', x: 40, y: 80, lat: -7.810, lng: 110.364, fontSize: 8, fontWeight: 'bold', color: '#78350f', angle: 0 },
        { id: 'lbl_malio', text: 'KORIDOR MALIOBORO', x: 42, y: 55, lat: -7.794, lng: 110.366, fontSize: 8, fontWeight: 'bold', color: '#78350f', angle: 90 },
        { id: 'lbl_depok', text: 'ZONA PENDIDIKAN SLEMAN (UGM)', x: 65, y: 30, lat: -7.770, lng: 110.385, fontSize: 8, fontWeight: 'bold', color: '#1e3a8a', angle: 0 },
      ]);
    } else if (preset.id === 'bali_selatan') {
      setBounds({
        minLng: 115.11,
        maxLng: 115.29,
        minLat: -8.76,
        maxLat: -8.59,
      });
      setSettings(prev => ({
        ...prev,
        title: 'PETA PARIWISATA METROPOLITAN SARBAGITA BALI',
        subtitle: 'Zonasi Wilayah Administrasi Wisata Kuta, Sanur, Kuta Utara, & Pusat Kota Denpasar',
        graticuleStep: 0.03,
        scaleBarLengthKm: 5,
        legendTitle: 'Kategori Sektor Wisata',
      }));
      setLabels([
        { id: 'lbl_kuta', text: 'KUTA & SEMINYAK', x: 25, y: 70, lat: -8.718, lng: 115.145, fontSize: 8, fontWeight: 'bold', color: '#9d174d', angle: 0 },
        { id: 'lbl_denpasar', text: 'KOTA DENPASAR', x: 55, y: 45, lat: -8.648, lng: 115.210, fontSize: 8, fontWeight: 'bold', color: '#1e3a8a', angle: 0 },
        { id: 'lbl_sanur', text: 'PANTAI SANUR', x: 80, y: 65, lat: -8.690, lng: 115.258, fontSize: 8, fontWeight: 'bold', color: '#065f46', angle: 0 },
      ]);
    }
  };

  // Zoom controls shifts geBounds on current focal percentages
  const handleZoom = (factor: number) => {
    const { minLng, maxLng, minLat, maxLat } = bounds;
    const midLng = (minLng + maxLng) / 2;
    const midLat = (minLat + maxLat) / 2;
    const dLng = (maxLng - minLng) * factor;
    const dLat = (maxLat - minLat) * factor;

    setBounds({
      minLng: midLng - dLng / 2,
      maxLng: midLng + dLng / 2,
      minLat: midLat - dLat / 2,
      maxLat: midLat + dLat / 2,
    });
  };

  // Move viewport directionally
  const handlePan = (dDirection: 'up' | 'down' | 'left' | 'right') => {
    const { minLng, maxLng, minLat, maxLat } = bounds;
    const dLng = (maxLng - minLng) * 0.15;
    const dLat = (maxLat - minLat) * 0.15;

    if (dDirection === 'up') {
      setBounds({ minLng, maxLng, minLat: minLat + dLat, maxLat: maxLat + dLat });
    } else if (dDirection === 'down') {
      setBounds({ minLng, maxLng, minLat: minLat - dLat, maxLat: maxLat - dLat });
    } else if (dDirection === 'left') {
      setBounds({ minLng: minLng - dLng, maxLng: maxLng - dLng, minLat, maxLat });
    } else if (dDirection === 'right') {
      setBounds({ minLng: minLng + dLng, maxLng: maxLng + dLng, minLat, maxLat });
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 overflow-hidden font-sans select-none">
      
      {/* Header Bar conforme standard "Geometric Balance" */}
      <header className="h-16 bg-white border-b border-slate-250 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-700 flex items-center justify-center shadow-md">
            <div className="w-4 h-4 border-2 border-white rotate-45"></div>
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase text-slate-900 select-none">
            Wilayah<span className="text-blue-700">Studi</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowExportModal(true)}
            className="bg-slate-900 hover:bg-blue-750 text-white px-4 py-2 text-xs font-bold transition-colors tracking-wider uppercase rounded-sm cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> CETAK / EKSPOR PETA
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Central Interactive Cartography Workshop Grid */}
        <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto space-y-4 bg-slate-50">
          
          {/* Header toolbar with robust responsiveness constraints to prevent collisions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-none shadow-sm">
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-xs font-bold font-mono tracking-widest text-blue-700 uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span> Modul Kartografi Jurnal
              </span>
              <p className="text-base md:text-lg font-extrabold text-slate-900 leading-tight mt-1 uppercase tracking-tight font-sans break-words pr-2">
                {settings.title || 'Desainer Peta Publikasi Jurnal'}
              </p>
            </div>

            {/* Zoom/Pan Quick Actions bar - isolated with z-index & explicit interactivity */}
            <div className="relative z-10 flex items-center gap-1 bg-slate-100 p-1 border border-slate-200 rounded-sm shrink-0 pointer-events-auto shadow-xs">
              <button
                onClick={() => handlePan('left')}
                className="p-1.5 rounded-sm hover:bg-white text-slate-700 hover:text-blue-700 transition-colors cursor-pointer text-xs font-bold"
                title="Geser Kiri"
              >
                ←
              </button>
              <button
                onClick={() => handlePan('right')}
                className="p-1.5 rounded-sm hover:bg-white text-slate-700 hover:text-blue-700 transition-colors cursor-pointer text-xs font-bold"
                title="Geser Kanan"
              >
                →
              </button>
              <button
                onClick={() => handlePan('up')}
                className="p-1.5 rounded-sm hover:bg-white text-slate-700 hover:text-blue-700 transition-colors cursor-pointer text-xs font-bold"
                title="Geser Atas"
              >
                ↑
              </button>
              <button
                onClick={() => handlePan('down')}
                className="p-1.5 rounded-sm hover:bg-white text-slate-700 hover:text-blue-700 transition-colors cursor-pointer text-xs font-bold"
                title="Geser Bawah"
              >
                ↓
              </button>
              <div className="w-px h-5 bg-slate-200 mx-1"></div>
              <button
                onClick={() => handleZoom(0.85)}
                className="p-1.5 rounded-sm hover:bg-white text-blue-700 hover:text-blue-800 transition-colors flex items-center gap-0.5 font-bold text-xs cursor-pointer"
                title="Perbesar Peta"
              >
                <ZoomIn className="w-3.5 h-3.5" /> +
              </button>
              <button
                onClick={() => handleZoom(1.15)}
                className="p-1.5 rounded-sm hover:bg-white text-blue-700 hover:text-blue-800 transition-colors flex items-center gap-0.5 font-bold text-xs cursor-pointer"
                title="Perkecil Peta"
              >
                <ZoomOut className="w-3.5 h-3.5" /> -
              </button>
              <button
                onClick={() => {
                  // Return to optimal bounding frame centering Menteng
                  setBounds({
                    minLng: 106.775,
                    maxLng: 106.875,
                    minLat: -6.225,
                    maxLat: -6.135,
                  });
                }}
                className="p-1.5 rounded-sm hover:bg-white text-slate-500 hover:text-slate-950 transition-colors cursor-pointer"
                title="Presisi Centered"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* The map layout display box with robust scroll containment and overflow isolation */}
          <div className="flex-1 min-h-[480px] lg:min-h-[520px] flex flex-col bg-slate-200 border border-slate-300 rounded-none p-4 shadow-sm relative overflow-hidden">
            <div className="flex-1 w-full overflow-auto flex relative scrollbar-thin">
              <div className="m-auto max-w-full">
                <MapCanvas
                  layers={layers}
                  settings={settings}
                  bounds={bounds}
                  labels={labels}
                  onUpdateLabels={setLabels}
                  selectedFeatureId={selectedFeature?.id || null}
                  onSelectFeature={(feat) => setSelectedFeature(feat)}
                  layoutWidth={layout.width}
                  layoutHeight={layout.height}
                  onUpdateSettings={(updates) => setSettings(prev => ({ ...prev, ...updates }))}
                />
              </div>
            </div>
          </div>

          {/* Feature quick attributes viewer footer helper */}
          <div className="p-4 bg-white border border-slate-200 rounded-none text-xs text-slate-600 leading-relaxed font-sans shadow-sm flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-750 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 uppercase tracking-widest text-[10px]">Kaidah Desain Jurnal Ilmiah / Kartografi Standar:</span>
              <p className="mt-1">
                Peta geospasial wajib memiliki arah mata angin, koordinat lintang/bujur (graticule) di tepian gambar, batasan wilayah administratif yang jelas, dan skala bar meter/kilometer yang akurat sesuai rasio cetak. Gunakan legenda di atas untuk memetakan parameter data penelitian sosial, geografi, atau pemukiman Anda.
              </p>
            </div>
          </div>
        </div>

        {/* Control panel sidebar */}
        <Sidebar
          layers={layers}
          settings={settings}
          bounds={bounds}
          labels={labels}
          onUpdateLayers={setLayers}
          onUpdateSettings={(updates) => setSettings(prev => ({ ...prev, ...updates }))}
          onUpdateLabels={setLabels}
          onUpdateBounds={setBounds}
          selectedFeature={selectedFeature}
          onSelectFeature={setSelectedFeature}
          onLoadPreset={handleLoadPreset}
        />
      </div>

      {/* Polish Export Menu Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-905/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-slate-900 w-full max-w-lg shadow-2xl flex flex-col rounded-none animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="border-b-2 border-slate-900 p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-400" />
                <span className="text-xs font-bold tracking-wider uppercase font-mono">Modul Cetak & Ekspor Peta Jurnal</span>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 text-slate-800">
              <p className="text-xs text-slate-600 leading-relaxed">
                Peta kartografi publikasi Anda siap diunduh atau dicetak. Silakan pilih salah satu opsi format ekspor di bawah ini:
              </p>

              <div className="grid grid-cols-1 gap-3">
                {/* Option 1: SVG Vector */}
                <button
                  onClick={() => {
                    const svgElement = document.getElementById('cartography-publication-svg');
                    if (svgElement) {
                      const serializer = new XMLSerializer();
                      let source = serializer.serializeToString(svgElement);
                      if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
                        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
                      }
                      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
                      const downloadLink = document.createElement('a');
                      downloadLink.href = url;
                      downloadLink.download = `peta_ilmiah_${Date.now()}.svg`;
                      document.body.appendChild(downloadLink);
                      downloadLink.click();
                      document.body.removeChild(downloadLink);
                      setShowExportModal(false);
                    }
                  }}
                  className="group flex items-start gap-4 p-4 border border-slate-200 hover:border-slate-900 transition-colors text-left bg-slate-50 hover:bg-white cursor-pointer rounded-none"
                >
                  <div className="p-2.5 bg-slate-900 text-white font-bold group-hover:bg-blue-700 transition-colors rounded-none">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold uppercase tracking-wider block text-slate-900 group-hover:text-blue-750">Unduh Format Vektor (.svg)</span>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Format standar publikasi jurnal (lossless). Resolusi peta tidak akan pecah saat di-zoom dan siap diimpor ke CorelDraw, Inkscape, Illustrator, atau Word.
                    </p>
                  </div>
                </button>

                {/* Option 2: Print Layer */}
                <button
                  onClick={() => {
                    setShowExportModal(false);
                    setTimeout(() => {
                      window.print();
                    }, 250);
                  }}
                  className="group flex items-start gap-4 p-4 border border-slate-200 hover:border-slate-900 transition-colors text-left bg-slate-50 hover:bg-white cursor-pointer rounded-none"
                >
                  <div className="p-2.5 bg-slate-900 text-white font-bold group-hover:bg-blue-700 transition-colors rounded-none">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold uppercase tracking-wider block text-slate-900 group-hover:text-blue-750">Cetak Peta Melalui Browser</span>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Mengaktifkan perintah cetak browser (Ctrl+P) untuk menyimpan langsung ke dokumen cetak PDF atau mencetak secara fisik.
                    </p>
                  </div>
                </button>
              </div>

              {/* Robust Troubleshooting Panel for IFrame Constraints */}
              <div className="p-4 bg-orange-50 border border-orange-200 text-[11px] text-orange-850 leading-relaxed space-y-1.5 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-orange-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold uppercase tracking-wider block text-[10px] text-orange-900">Pemberitahuan Navigasi (IFrame):</span>
                  <p className="mt-1">
                    Kebijakan browser Anda membatasi pembukaan jendela pop-up cetak (Print) / dialog browser jika aplikasi dijalankan di dalam bingkai prapanduan preview.
                  </p>
                  <p className="font-semibold text-orange-950 mt-1.5">
                    Solusi: Jika tombol cetak tidak memunculkan dialog, klik tombol <span className="underline">"Open in a new tab"</span> di pojok kanan atas layar prapanduan editor ini, lalu lakukan cetak/save PDF disana secara tak terhambat!
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 bg-slate-50 p-4 flex justify-end">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-xs font-bold uppercase border border-slate-300 hover:border-slate-900 transition-all text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
