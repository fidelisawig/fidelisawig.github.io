/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapLayer } from '../types';

export interface IndonesianPresetCollection {
  id: string;
  name: string;
  description: string;
  cityName: string;
  layers: MapLayer[];
}

export const INDONESIAN_PRESETS: IndonesianPresetCollection[] = [
  {
    id: 'jakarta_pusat',
    name: 'Kecamatan di DKI Jakarta Pusat',
    description: 'Batas wilayah administratif kecamatan utama di Jakarta Pusat (Menteng, Tanah Abang, Senen, dkk) lengkap dengan data koordinat riil.',
    cityName: 'Jakarta Pusat',
    layers: [
      {
        id: 'jakarta_kecamatan',
        name: 'Kecamatan Jakarta Pusat',
        visible: true,
        color: '#eff6ff',
        strokeColor: '#1e3a8a',
        strokeWidth: 2,
        fillOpacity: 0.3,
        categoryField: 'Kepadatan',
        categoriesColorMap: {
          'Sangat Tinggi': '#fee2e2',
          'Tinggi': '#ffedd5',
          'Sedang': '#ecfdf5',
        },
        features: [
          {
            id: 'jk01',
            type: 'Feature',
            layerId: 'jakarta_kecamatan',
            properties: {
              name: 'Kecamatan Menteng',
              Kepadatan: 'Tinggi',
              Penduduk: '89.400 Jiwa',
              Luas: '6,53 km²',
              Deskripsi: 'Pusat pemerintahan sipil, perumahan elitis, dan wilayah historis kolonial.'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [106.815, -6.185],
                [106.835, -6.185],
                [106.845, -6.205],
                [106.830, -6.215],
                [106.810, -6.210],
                [106.815, -6.185]
              ]]
            }
          },
          {
            id: 'jk02',
            type: 'Feature',
            layerId: 'jakarta_kecamatan',
            properties: {
              name: 'Kecamatan Tanah Abang',
              Kepadatan: 'Sangat Tinggi',
              Penduduk: '147.800 Jiwa',
              Luas: '9,30 km²',
              Deskripsi: 'Pusat grosir tekstil terbesar di Asia Tenggara dan perkantoran bisnis Sudirman.'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [106.790, -6.180],
                [106.815, -6.185],
                [106.810, -6.210],
                [106.792, -6.215],
                [106.785, -6.195],
                [106.790, -6.180]
              ]]
            }
          },
          {
            id: 'jk03',
            type: 'Feature',
            layerId: 'jakarta_kecamatan',
            properties: {
              name: 'Kecamatan Senen',
              Kepadatan: 'Sangat Tinggi',
              Penduduk: '121.500 Jiwa',
              Luas: '5,40 km²',
              Deskripsi: 'Stasiun Senen, pasar grosir, pusat administrasi niaga dan pemukiman padat.'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [106.835, -6.185],
                [106.855, -6.182],
                [106.858, -6.200],
                [106.845, -6.205],
                [106.835, -6.185]
              ]]
            }
          },
          {
            id: 'jk04',
            type: 'Feature',
            layerId: 'jakarta_kecamatan',
            properties: {
              name: 'Kecamatan Gambir',
              Kepadatan: 'Sedang',
              Penduduk: '95.200 Jiwa',
              Luas: '7,60 km²',
              Deskripsi: 'Lokasi Monumen Nasional (Monas), Istana Merdeka, Kompleks Kementerian RI.'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [106.790, -6.160],
                [106.830, -6.162],
                [106.835, -6.185],
                [106.815, -6.185],
                [106.790, -6.180],
                [106.790, -6.160]
              ]]
            }
          },
          {
            id: 'jk05',
            type: 'Feature',
            layerId: 'jakarta_kecamatan',
            properties: {
              name: 'Kecamatan Sawah Besar',
              Kepadatan: 'Tinggi',
              Penduduk: '126.300 Jiwa',
              Luas: '5,54 km²',
              Deskripsi: 'Gereja Katedral Jakarta, Masjid Istiqlal, dan kawasan perdagangan Pasar Baru.'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [106.810, -6.145],
                [106.838, -6.148],
                [106.830, -6.162],
                [106.790, -6.160],
                [106.810, -6.145]
              ]]
            }
          },
          {
            id: 'jk06',
            type: 'Feature',
            layerId: 'jakarta_kecamatan',
            properties: {
              name: 'Kecamatan Kemayoran',
              Kepadatan: 'Sangat Tinggi',
              Penduduk: '250.700 Jiwa',
              Luas: '9,25 km²',
              Deskripsi: 'Bekas landasan udara bandara Kemayoran, kini kompleks JIExpo Pekan Raya Jakarta.'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [106.830, -6.162],
                [106.865, -6.155],
                [106.870, -6.175],
                [106.855, -6.182],
                [106.835, -6.185],
                [106.830, -6.162]
              ]]
            }
          }
        ]
      }
    ]
  },
  {
    id: 'yogyakarta_sleman',
    name: 'Kawasan Wisata Kraton & Sleman, Yogyakarta',
    description: 'Peta zonasi budaya dan pariwisata metropolitan Yogyakarta mencakup kawasan utama Kraton, Malioboro, dan Depok.',
    cityName: 'Yogyakarta',
    layers: [
      {
        id: 'jogja_zones',
        name: 'Zona Budaya Yogyakarta',
        visible: true,
        color: '#fef3c7',
        strokeColor: '#b45309',
        strokeWidth: 2,
        fillOpacity: 0.3,
        categoryField: 'Zonasi',
        categoriesColorMap: {
          'Kawasan Pusaka Kraton': '#fee2e2',
          'Pusat Komersial Turis': '#fffdb8',
          'Kawasan Edukasi/Akademik': '#d1fae5',
        },
        features: [
          {
            id: 'yg01',
            type: 'Feature',
            layerId: 'jogja_zones',
            properties: {
              name: 'Kawasan Pusaka Kraton',
              Zonasi: 'Kawasan Pusaka Kraton',
              Penduduk: '28.300 Jiwa',
              Luas: '2,10 km²',
              Deskripsi: 'Jantung budaya Keraton Ngayogyakarta Hadiningrat, Alun-Alun Kidul, dan komplek Tamansari.'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [110.358, -7.818],
                [110.375, -7.818],
                [110.375, -7.802],
                [110.358, -7.802],
                [110.358, -7.818]
              ]]
            }
          },
          {
            id: 'yg02',
            type: 'Feature',
            layerId: 'jogja_zones',
            properties: {
              name: 'Koridor Malioboro',
              Zonasi: 'Pusat Komersial Turis',
              Penduduk: '15.200 Jiwa',
              Luas: '1,45 km²',
              Deskripsi: 'Pusat belanja cinderamata, pedestrian sejarah, dan akses utama Stasiun Tugu Jogja.'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [110.358, -7.802],
                [110.375, -7.802],
                [110.375, -7.785],
                [110.358, -7.785],
                [110.358, -7.802]
              ]]
            }
          },
          {
            id: 'yg03',
            type: 'Feature',
            layerId: 'jogja_zones',
            properties: {
              name: 'Kawasan Edukasi Caturtunggal/Depok',
              Zonasi: 'Kawasan Edukasi/Akademik',
              Penduduk: '128.900 Jiwa',
              Luas: '11,20 km²',
              Deskripsi: 'Pusat pendidikan tinggi universitas negeri terkemuka (UGM, UNY, dkk).'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [110.370, -7.785],
                [110.402, -7.785],
                [110.402, -7.755],
                [110.370, -7.755],
                [110.370, -7.785]
              ]]
            }
          }
        ]
      }
    ]
  },
  {
    id: 'bali_selatan',
    name: 'Kawasan Metropolitan Sarbagita, Bali',
    description: 'Pembagian wilayah administratif pariwisata di Bali Selatan (Denpasar, Badung, Kuta, dan Seminyak).',
    cityName: 'Bali Selatan',
    layers: [
      {
        id: 'bali_districts',
        name: 'Kawasan Pariwisata Bali',
        visible: true,
        color: '#edfcf2',
        strokeColor: '#047857',
        strokeWidth: 2,
        fillOpacity: 0.3,
        categoryField: 'Zonasi',
        categoriesColorMap: {
          'Pariwisata Internasional': '#fce7f3',
          'Pusat Pemerintahan & Niaga': '#e0f2fe',
          'Budaya & Alam': '#ecfdf5',
        },
        features: [
          {
            id: 'bl01',
            type: 'Feature',
            layerId: 'bali_districts',
            properties: {
              name: 'Kawasan Kuta & Seminyak',
              Zonasi: 'Pariwisata Internasional',
              Kabupaten: 'Badung',
              Pengunjung: '3,8 Juta / Tahun',
              Deskripsi: 'Kawasan pantai pasir putih premium, hiburan, hotel bintang lima, dan rekreasi kuliner.'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [115.130, -8.740],
                [115.170, -8.740],
                [115.170, -8.675],
                [115.130, -8.675],
                [115.130, -8.740]
              ]]
            }
          },
          {
            id: 'bl02',
            type: 'Feature',
            layerId: 'bali_districts',
            properties: {
              name: 'Kota Denpasar Pusat',
              Zonasi: 'Pusat Pemerintahan & Niaga',
              Kabupaten: 'Denpasar Kota',
              Pengunjung: '1,2 Juta / Tahun',
              Deskripsi: 'Pusat administrasi Provinsi Bali, Universitas Udayana, Lapangan Puputan, museum bali.'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [115.170, -8.675],
                [115.250, -8.675],
                [115.250, -8.610],
                [115.170, -8.610],
                [115.170, -8.675]
              ]]
            }
          },
          {
            id: 'bl03',
            type: 'Feature',
            layerId: 'bali_districts',
            properties: {
              name: 'Kawasan Sanur Tradisional',
              Zonasi: 'Budaya & Alam',
              Kabupaten: 'Denpasar Timur',
              Pengunjung: '2,1 Juta / Tahun',
              Deskripsi: 'Kawasan wisata pantai yang lebih tenang, pelabuhan penyeberangan ke Nusa Penida.'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [115.230, -8.718],
                [115.275, -8.718],
                [115.275, -8.665],
                [115.230, -8.665],
                [115.230, -8.718]
              ]]
            }
          }
        ]
      }
    ]
  }
];
