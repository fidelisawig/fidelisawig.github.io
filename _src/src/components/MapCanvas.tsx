/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { MapLayer, MapSettings, MapLabel, GeographicBounds, COLOR_PRESETS } from '../types';
import { project, unproject, decimalToDMS, calculateDistanceInPixels, calculateRepresentativeScale } from '../utils/geo';

interface MapCanvasProps {
  layers: MapLayer[];
  settings: MapSettings;
  bounds: GeographicBounds;
  labels: MapLabel[];
  onUpdateLabels: (labels: MapLabel[]) => void;
  selectedFeatureId: string | number | null;
  onSelectFeature: (feature: any) => void;
  layoutWidth: number;
  layoutHeight: number;
  onUpdateSettings: (settings: Partial<MapSettings>) => void;
}

export default function MapCanvas({
  layers,
  settings,
  bounds,
  labels,
  onUpdateLabels,
  selectedFeatureId,
  onSelectFeature,
  layoutWidth,
  layoutHeight,
  onUpdateSettings,
}: MapCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Drag and drop state for items (Legend, Scale Bar, North Arrow, Custom Labels)
  const [draggingItem, setDraggingItem] = useState<{
    type: 'legend' | 'scale' | 'north' | 'label';
    id?: string;
    startX: number;
    startY: number;
  } | null>(null);

  const colors = COLOR_PRESETS[settings.theme];

  const wrapSVGText = (text: string, maxCharsPerLine: number) => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // Define the Map Plot Area boundary coordinates within the paper
  // Margin dictates how much breathing room coordinate ticks have
  const margin = settings.margin;
  const hasRightPanel = settings.layoutPeripheralPanel;
  
  // Calculate dynamic panel width bounded based on layoutWidth
  const panelWidth = hasRightPanel ? Math.min(260, Math.max(160, layoutWidth * 0.23)) : 0;
  
  const plotX = margin;
  // If we have a right-hand panel, our title is in the panel, so plot can occupy full height
  const plotY = margin + (hasRightPanel ? 15 : (settings.showTitle ? 60 : 20));
  const plotWidth = hasRightPanel
    ? Math.max(100, layoutWidth - panelWidth - margin * 2.5) // balance spacing for right coordinate ticks
    : Math.max(100, layoutWidth - margin * 2);
  const plotHeight = Math.max(100, layoutHeight - plotY - margin);

  const rightPanelX = layoutWidth - panelWidth - margin;
  const rightPanelY = plotY;

  // Helper projection that is bounded strictly inside the Map Plot Area
  const projectToMap = (lng: number, lat: number) => {
    const projected = project(lng, lat, bounds, plotWidth, plotHeight, settings.projection);
    return {
      x: plotX + projected.x,
      y: plotY + projected.y,
    };
  };

  // Helper inverse projection that translates SVG cursor to coordinate points
  const unprojectFromMap = (svgX: number, svgY: number) => {
    const rx = svgX - plotX;
    const ry = svgY - plotY;
    return unproject(rx, ry, bounds, plotWidth, plotHeight, settings.projection);
  };

  // Helper to resolve different XYZ tile providers
  const getTileUrl = (provider: 'osm' | 'hillshade' | 'opentopo' | 'terrain' | 'imagery', x: number, y: number, z: number) => {
    switch (provider) {
      case 'hillshade':
        return `https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/${z}/${y}/${x}`;
      case 'imagery':
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
      case 'opentopo':
        return `https://tile.opentopomap.org/${z}/${x}/${y}.png`;
      case 'terrain':
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/${z}/${y}/${x}`;
      case 'osm':
      default:
        return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    }
  };

  // OpenStreetMap Tile generation helper for SVG standard imagery
  const getOSMTiles = (currentBounds: GeographicBounds, width: number, height: number) => {
    const { minLng, maxLng, minLat, maxLat } = currentBounds;
    const lngDifference = Math.max(0.0001, Math.abs(maxLng - minLng));
    
    // Choose starting zoom level based on decimal degree span
    let z = Math.min(19, Math.max(0, Math.round(Math.log2(1260 / lngDifference))));

    interface Tile {
      x: number;
      y: number;
      z: number;
    }
    const tilesList: Tile[] = [];

    while (z >= 0) {
      const minTileX = Math.floor(((minLng + 180) / 360) * Math.pow(2, z));
      const maxTileX = Math.floor(((maxLng + 180) / 360) * Math.pow(2, z));
      
      const latRadMin = (Math.max(-85, Math.min(85, minLat)) * Math.PI) / 180;
      const latRadMax = (Math.max(-85, Math.min(85, maxLat)) * Math.PI) / 180;
      
      const minTileY = Math.floor(
        ((1 - Math.log(Math.tan(latRadMax) + 1 / Math.cos(latRadMax)) / Math.PI) / 2) * Math.pow(2, z)
      );
      const maxTileY = Math.floor(
        ((1 - Math.log(Math.tan(latRadMin) + 1 / Math.cos(latRadMin)) / Math.PI) / 2) * Math.pow(2, z)
      );

      // Safe bounds with padding of 1 tile to ensure gapless/boundary-free full canvas overlap
      const startX = Math.max(0, Math.min(minTileX, maxTileX) - 1);
      const endX = Math.min(Math.pow(2, z) - 1, Math.max(minTileX, maxTileX) + 1);
      const startY = Math.max(0, Math.min(minTileY, maxTileY) - 1);
      const endY = Math.min(Math.pow(2, z) - 1, Math.max(minTileY, maxTileY) + 1);

      const countX = endX - startX + 1;
      const countY = endY - startY + 1;
      const totalTiles = countX * countY;

      // Limit OSM tiles count to ensure rendering performance, upgraded to 90 for crisp display on higher resolutions
      if (totalTiles <= 90 || z === 0) {
        for (let x = startX; x <= endX; x++) {
          for (let y = startY; y <= endY; y++) {
            tilesList.push({ x, y, z });
          }
        }
        break;
      } else {
        z--;
      }
    }
    return tilesList;
  };

  // Inset Map dimensions and regional boundaries calculation
  const insetWidth = 140;
  const insetHeight = 140;
  let insetX = plotX + 10;
  let insetY = plotY + 10;

  if (settings.insetMapPosition === 'top-right') {
    insetX = plotX + plotWidth - insetWidth - 10;
    insetY = plotY + 10;
  } else if (settings.insetMapPosition === 'bottom-left') {
    insetX = plotX + 10;
    insetY = plotY + plotHeight - insetHeight - 10;
  } else if (settings.insetMapPosition === 'bottom-right') {
    insetX = plotX + plotWidth - insetWidth - 10;
    insetY = plotY + plotHeight - insetHeight - 10;
  }

  const centerLng = (bounds.minLng + bounds.maxLng) / 2;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const dLng = Math.abs(bounds.maxLng - bounds.minLng);
  const dLat = Math.abs(bounds.maxLat - bounds.minLat);
  const insetScaleField = settings.insetMapScale || 8.0;

  const insetBounds: GeographicBounds = {
    minLng: centerLng - (dLng * insetScaleField) / 2,
    maxLng: centerLng + (dLng * insetScaleField) / 2,
    minLat: centerLat - (dLat * insetScaleField) / 2,
    maxLat: centerLat + (dLat * insetScaleField) / 2,
  };

  const projectToInset = (lng: number, lat: number) => {
    const projected = project(lng, lat, insetBounds, insetWidth, insetHeight, settings.projection);
    return {
      x: projected.x,
      y: projected.y,
    };
  };

  const renderPolygonPathInset = (geometry: any) => {
    if (!geometry) return '';
    const { type, coordinates } = geometry;

    if (type === 'Polygon') {
      return coordinates
        .map((ring: any) => {
          if (!ring || ring.length === 0) return '';
          const pts = ring.map((pt: any) => {
            const projected = projectToInset(pt[0], pt[1]);
            return `${projected.x},${projected.y}`;
          });
          return `M ${pts.join(' L ')} Z`;
        })
        .join(' ');
    } else if (type === 'MultiPolygon') {
      return coordinates
        .map((poly: any) => {
          return poly
            .map((ring: any) => {
              if (!ring || ring.length === 0) return '';
              const pts = ring.map((pt: any) => {
                const projected = projectToInset(pt[0], pt[1]);
                return `${projected.x},${projected.y}`;
              });
              return `M ${pts.join(' L ')} Z`;
            })
            .join(' ');
        })
        .join(' ');
    } else if (type === 'LineString') {
      const pts = coordinates.map((pt: any) => {
        const projected = projectToInset(pt[0], pt[1]);
        return `${projected.x},${projected.y}`;
      });
      return `M ${pts.join(' L ')}`;
    }
    return '';
  };

  // Graticule ticks calculation
  const getGraticuleTicks = () => {
    const lngTicks: number[] = [];
    const latTicks: number[] = [];

    if (!settings.showGraticule) return { lngTicks, latTicks };

    const { minLng, maxLng, minLat, maxLat } = bounds;
    const step = settings.graticuleStep;

    const startLng = Math.ceil(minLng / step) * step;
    for (let val = startLng; val <= maxLng; val += step) {
      lngTicks.push(val);
    }

    const startLat = Math.ceil(minLat / step) * step;
    for (let val = startLat; val <= maxLat; val += step) {
      latTicks.push(val);
    }

    return { lngTicks, latTicks };
  };

  const { lngTicks, latTicks } = getGraticuleTicks();

  // Mouse handlers for drag and drop
  const handleMouseDown = (e: React.MouseEvent, type: 'legend' | 'scale' | 'north' | 'label', id?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    setDraggingItem({
      type,
      id,
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingItem) return;
    e.preventDefault();

    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    // Determine coordinate scale ratio
    const dx = ((e.clientX - draggingItem.startX) / svgRect.width) * layoutWidth;
    const dy = ((e.clientY - draggingItem.startY) / svgRect.height) * layoutHeight;

    if (draggingItem.type === 'legend') {
      const newX = Math.max(0, Math.min(100, settings.legendPosition.x + (dx / layoutWidth) * 100));
      const newY = Math.max(0, Math.min(100, settings.legendPosition.y + (dy / layoutHeight) * 100));
      onUpdateSettings({ legendPosition: { x: newX, y: newY } });
    } else if (draggingItem.type === 'scale') {
      const newX = Math.max(0, Math.min(100, settings.scaleBarPosition.x + (dx / layoutWidth) * 100));
      const newY = Math.max(0, Math.min(100, settings.scaleBarPosition.y + (dy / layoutHeight) * 100));
      onUpdateSettings({ scaleBarPosition: { x: newX, y: newY } });
    } else if (draggingItem.type === 'north') {
      const newX = Math.max(0, Math.min(100, settings.northArrowPosition.x + (dx / layoutWidth) * 100));
      const newY = Math.max(0, Math.min(100, settings.northArrowPosition.y + (dy / layoutHeight) * 100));
      onUpdateSettings({ northArrowPosition: { x: newX, y: newY } });
    } else if (draggingItem.type === 'label' && draggingItem.id) {
      // For labels, we update their persistent position percentage inside the layout
      const updatedLabels = labels.map(lbl => {
        if (lbl.id === draggingItem.id) {
          const newX = Math.max(0, Math.min(100, lbl.x + (dx / layoutWidth) * 100));
          const newY = Math.max(0, Math.min(100, lbl.y + (dy / layoutHeight) * 100));
          
          // Re-project lat/lng if we drag the coordinate anchored labels
          const geocoords = unprojectFromMap((newX / 100) * layoutWidth, (newY / 100) * layoutHeight);
          return {
            ...lbl,
            x: newX,
            y: newY,
            lat: geocoords.lat,
            lng: geocoords.lng,
          };
        }
        return lbl;
      });
      onUpdateLabels(updatedLabels);
    }

    // Reset starting point
    setDraggingItem(prev => (prev ? { ...prev, startX: e.clientX, startY: e.clientY } : null));
  };

  const handleMouseUp = () => {
    setDraggingItem(null);
  };

  // Compute pixel width of scale bar based on actual earth geometry
  const scaleBarMeters = settings.scaleBarLengthKm * (settings.scaleBarUnit === 'km' ? 1000 : 1);
  const scaleWidthPx = calculateDistanceInPixels(
    bounds,
    plotWidth,
    plotHeight,
    scaleBarMeters,
    settings.projection
  );

  // Translate geographic polygon paths to SVG paths string
  const renderPolygonPath = (geometry: any) => {
    if (!geometry) return '';
    const { type, coordinates } = geometry;

    if (type === 'Polygon') {
      return coordinates
        .map((ring: any) => {
          if (!ring || ring.length === 0) return '';
          const pts = ring.map((pt: any) => {
            const projected = projectToMap(pt[0], pt[1]);
            return `${projected.x},${projected.y}`;
          });
          return `M ${pts.join(' L ')} Z`;
        })
        .join(' ');
    } else if (type === 'MultiPolygon') {
      return coordinates
        .map((poly: any) => {
          return poly
            .map((ring: any) => {
              if (!ring || ring.length === 0) return '';
              const pts = ring.map((pt: any) => {
                const projected = projectToMap(pt[0], pt[1]);
                return `${projected.x},${projected.y}`;
              });
              return `M ${pts.join(' L ')} Z`;
            })
            .join(' ');
        })
        .join(' ');
    } else if (type === 'LineString') {
      const pts = coordinates.map((pt: any) => {
        const projected = projectToMap(pt[0], pt[1]);
        return `${projected.x},${projected.y}`;
      });
      return `M ${pts.join(' L ')}`;
    } else if (type === 'MultiLineString') {
      return coordinates
        .map((line: any) => {
          const pts = line.map((pt: any) => {
            const projected = projectToMap(pt[0], pt[1]);
            return `${projected.x},${projected.y}`;
          });
          return `M ${pts.join(' L ')}`;
        })
        .join(' ');
    } else if (type === 'Point') {
      const projected = projectToMap(coordinates[0], coordinates[1]);
      return `M ${projected.x - 4},${projected.y} a 4,4 0 1,0 8,0 a 4,4 0 1,0 -8,0`;
    }
    return '';
  };

  // Collect categorizations for Legend
  const getLegendCategories = () => {
    const items: { label: string; color: string; sourceLayer: string }[] = [];
    layers.forEach(layer => {
      if (!layer.visible) return;
      
      if (layer.categoryField && layer.categoriesColorMap) {
        // Choropleth categories
        Object.entries(layer.categoriesColorMap).forEach(([catValue, color]) => {
          items.push({
            label: `${layer.name}: ${catValue}`,
            color: color,
            sourceLayer: layer.name,
          });
        });
      } else {
        // Simple uniform layers
        items.push({
          label: layer.name,
          color: layer.color,
          sourceLayer: layer.name,
        });
      }
    });
    return items;
  };

  const legendItems = getLegendCategories();

  // Scale bar subdivisions for checking looks
  const subdivisions = 4;

  // Formatting coordinates helper
  const formatCoordLabel = (val: number, isLng: boolean) => {
    if (settings.gridAnnotationFormat === 'DMS') {
      return decimalToDMS(val, isLng);
    }
    const suffix = isLng ? (val >= 0 ? ' BT' : ' BB') : (val >= 0 ? ' LU' : ' LS');
    return val.toFixed(4) + '°' + suffix;
  };

  // Auto layout size updates based on dragging elements
  const legendX = (settings.legendPosition.x / 100) * layoutWidth;
  const legendY = (settings.legendPosition.y / 100) * layoutHeight;

  const scaleX = (settings.scaleBarPosition.x / 100) * layoutWidth;
  const scaleY = (settings.scaleBarPosition.y / 100) * layoutHeight;

  const northX = (settings.northArrowPosition.x / 100) * layoutWidth;
  const northY = (settings.northArrowPosition.y / 100) * layoutHeight;

  return (
    <div className="relative w-full flex justify-center py-8 bg-slate-250 overflow-auto select-none shadow-inner border border-slate-300">
      <svg
        id="cartography-publication-svg"
        ref={svgRef}
        viewBox={`0 0 ${layoutWidth} ${layoutHeight}`}
        className="w-full max-w-4xl bg-white shadow-2xl border-[12px] border-white transition-all duration-300"
        style={{
          aspectRatio: `${layoutWidth} / ${layoutHeight}`,
          backgroundColor: colors.bg,
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <style>{`
            .academic-font {
              font-family: 'Inter', 'Times New Roman', Times, serif;
            }
            .mono-font {
              font-family: 'JetBrains Mono', Courier, monospace;
            }
            .graticule-grid-line {
              stroke: ${colors.grid};
              stroke-width: 0.8px;
              stroke-dasharray: ${settings.graticuleStyle === 'dashed' ? '5 5' : settings.graticuleStyle === 'dotted' ? '2 2' : 'none'};
            }
          `}</style>
          
          {/* Main Map Clipping Area */}
          <clipPath id="map-plot-clip">
            <rect x={plotX} y={plotY} width={plotWidth} height={plotHeight} />
          </clipPath>
          
          {/* North Arrow SVGs */}
          {settings.showNorthArrow && (
            <g id="north-arrow-classic">
              <path d="M 0,-25 L 7,0 L 0,-6 L -7,0 Z" fill={colors.stroke} stroke={colors.stroke} strokeWidth="1" />
              <path d="M 0,-25 L 0,-6 L 7,0 Z" fill={colors.text} />
              <path d="M 0,0 L 4,14 L 0,8 L -4,14 Z" fill={colors.stroke} stroke={colors.stroke} strokeWidth="1" />
              <path d="M 0,0 L 0,8 L 4,14 Z" fill={colors.text} />
              <text x="-4" y="-28" fontSize="10" fontWeight="bold" fill={colors.text} className="academic-font">U</text>
            </g>
          )}
          {settings.showNorthArrow && (
            <g id="north-arrow-modern">
              <circle cx="0" cy="0" r="14" fill="none" stroke={colors.stroke} strokeWidth="1.5" />
              <path d="M 0,-18 L 4,-3 L 0,-6 L -4,-3 Z" fill={colors.stroke} stroke={colors.stroke} strokeWidth="1" />
              <path d="M 0,-18 L 0,-6 L 4,-3 Z" fill={colors.text} />
              <line x1="0" y1="6" x2="0" y2="14" stroke={colors.stroke} strokeWidth="1.5" />
              <text x="-3" y="-21" fontSize="9" fontWeight="bold" fill={colors.text} className="academic-font">U</text>
            </g>
          )}
          {settings.showNorthArrow && (
            <g id="north-arrow-minimal">
              <line x1="0" y1="18" x2="0" y2="-18" stroke={colors.stroke} strokeWidth="1.5" />
              <path d="M 0,-18 L -4,-8 M 0,-18 L 4,-8" stroke={colors.stroke} strokeWidth="1.5" strokeLinecap="round" />
              <text x="5" y="-12" fontSize="10" fontWeight="bold" fill={colors.text} className="academic-font">U</text>
            </g>
          )}

          {/* Dynamic Linear Gradients for Theme Legends */}
          {layers.map((layer) => {
            if (!layer.visible || !layer.categoryField || !layer.categoriesColorMap) return null;
            const colorsList = Object.values(layer.categoriesColorMap);
            if (colorsList.length === 0) return null;
            return (
              <linearGradient id={`layer-grad-${layer.id}`} key={`grad-${layer.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                {colorsList.map((color, cIdx) => (
                  <stop
                    key={`stop-${cIdx}`}
                    offset={`${colorsList.length > 1 ? (cIdx / (colorsList.length - 1)) * 100 : 100}%`}
                    stopColor={color}
                  />
                ))}
              </linearGradient>
            );
          })}
        </defs>

        {/* Paper outer frame border background */}
        <rect x="0" y="0" width={layoutWidth} height={layoutHeight} fill={colors.bg} stroke="none" />

        {/* Dynamic Titles */}
        {settings.showTitle && !hasRightPanel && (
          <g>
            <text
              x={layoutWidth / 2}
              y="32"
              textAnchor="middle"
              className="academic-font uppercase tracking-wider text-slate-950 font-bold"
              fontSize="16"
              fill={colors.text}
            >
              {settings.title || 'PETA WILAYAH PENELITIAN'}
            </text>
            {settings.showSubtitle && (
              <text
                x={layoutWidth / 2}
                y="48"
                textAnchor="middle"
                className="academic-font italic tracking-normal"
                fontSize="10"
                fill={colors.stroke}
              >
                {settings.subtitle || 'Proyeksi Mercator - Garis Batas Wilayah Administratif'}
              </text>
            )}
          </g>
        )}

        {/* Map Plot Area Frame */}
        <rect
          x={plotX}
          y={plotY}
          width={plotWidth}
          height={plotHeight}
          fill="white" // Keep map plot container clear white for maximum visual paper replication
          stroke={colors.stroke}
          strokeWidth="1.5"
        />

        {/* Basemap Layer */}
        {settings.showBasemap && (
          <g id="map-basemap" clipPath="url(#map-plot-clip)" opacity={settings.basemapOpacity}>
            {getOSMTiles(bounds, plotWidth, plotHeight).map((tile, tIdx) => {
              const tileMinLng = (tile.x / Math.pow(2, tile.z)) * 360 - 180;
              const tileMaxLng = ((tile.x + 1) / Math.pow(2, tile.z)) * 360 - 180;
              
              const tileYToLat = (ty: number, tz: number) => {
                const n = Math.PI - (2 * Math.PI * ty) / Math.pow(2, tz);
                return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
              };
              
              const tileMaxLat = tileYToLat(tile.y, tile.z);
              const tileMinLat = tileYToLat(tile.y + 1, tile.z);
              
              const topLeft = projectToMap(tileMinLng, tileMaxLat);
              const bottomRight = projectToMap(tileMaxLng, tileMinLat);
              
              return (
                <image
                  key={`basemap-tile-${tile.z}-${tile.x}-${tile.y}-${tIdx}`}
                  href={getTileUrl(settings.basemapProvider || 'osm', tile.x, tile.y, tile.z)}
                  x={topLeft.x}
                  y={topLeft.y}
                  width={bottomRight.x - topLeft.x + 0.5}
                  height={bottomRight.y - topLeft.y + 0.5}
                  referrerPolicy="no-referrer"
                />
              );
            })}
          </g>
        )}

        {/* Dynamic Graticule Grid Lines & Inner Map Grid */}
        <g id="map-graticules">
          {settings.showGraticule && (
            <>
              {/* Longitude gridlines */}
              {lngTicks.map((lng, i) => {
                const p1 = projectToMap(lng, bounds.minLat);
                const p2 = projectToMap(lng, bounds.maxLat);
                if (p1.x < plotX || p1.x > plotX + plotWidth) return null;
                return (
                  <line
                    key={`grid-lng-${i}`}
                    x1={p1.x}
                    y1={plotY}
                    x2={p1.x}
                    y2={plotY + plotHeight}
                    className="graticule-grid-line"
                  />
                );
              })}
              {/* Latitude gridlines */}
              {latTicks.map((lat, i) => {
                const p1 = projectToMap(bounds.minLng, lat);
                const p2 = projectToMap(bounds.maxLng, lat);
                if (p1.y < plotY || p1.y > plotY + plotHeight) return null;
                return (
                  <line
                    key={`grid-lat-${i}`}
                    x1={plotX}
                    y1={p1.y}
                    x2={plotX + plotWidth}
                    y2={p1.y}
                    className="graticule-grid-line"
                  />
                );
              })}
            </>
          )}
        </g>

        {/* Map Layers Features Polygons */}
        <g id="map-features">
          {layers.map((layer) => {
            if (!layer.visible) return null;
            return layer.features.map((feature, fIdx) => {
              const isSelected = selectedFeatureId === feature.id;
              
              // Decide coloring scheme
              let fillcolor = layer.color;
              if (layer.categoryField && layer.categoriesColorMap) {
                const val = feature.properties[layer.categoryField];
                if (val && layer.categoriesColorMap[val]) {
                  fillcolor = layer.categoriesColorMap[val];
                }
              }

              return (
                <path
                  key={`feature-${layer.id}-${feature.id}-${fIdx}`}
                  d={renderPolygonPath(feature.geometry)}
                  fill={fillcolor}
                  fillOpacity={isSelected ? 0.6 : layer.fillOpacity}
                  stroke={isSelected ? '#dc2626' : layer.strokeColor}
                  strokeWidth={isSelected ? 3 : layer.strokeWidth}
                  className="cursor-pointer transition-all hover:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectFeature(feature);
                  }}
                />
              );
            });
          })}
        </g>

        {/* Inner Map Plot Border ticks & coordinate numerical grids annotated on outer margin borders */}
        <g id="map-border-annotations" className="mono-font select-none" fontSize="8" fill={colors.text}>
          {lngTicks.map((lng, i) => {
            const p = projectToMap(lng, bounds.minLat);
            if (p.x < plotX - 2 || p.x > plotX + plotWidth + 2) return null;

            return (
              <g key={`border-lng-${i}`}>
                {/* Bottom Border Notation */}
                <line x1={p.x} y1={plotY + plotHeight} x2={p.x} y2={plotY + plotHeight + 4} stroke={colors.stroke} strokeWidth="1" />
                <text x={p.x} y={plotY + plotHeight + 12} textAnchor="middle" fontSize="7" fill={colors.text} fontWeight="500">
                  {formatCoordLabel(lng, true)}
                </text>

                {/* Top Border Notation */}
                <line x1={p.x} y1={plotY} x2={p.x} y2={plotY - 4} stroke={colors.stroke} strokeWidth="1" />
                <text x={p.x} y={plotY - 6} textAnchor="middle" fontSize="7" fill={colors.text} fontWeight="500">
                  {formatCoordLabel(lng, true)}
                </text>
              </g>
            );
          })}

          {latTicks.map((lat, i) => {
            const p = projectToMap(bounds.minLng, lat);
            if (p.y < plotY - 2 || p.y > plotY + plotHeight + 2) return null;

            return (
              <g key={`border-lat-${i}`}>
                 {/* Left Border Notation */}
                 <line x1={plotX} y1={p.y} x2={plotX - 4} y2={p.y} stroke={colors.stroke} strokeWidth="1" />
                 <text
                   x={plotX - 8}
                   y={p.y}
                   textAnchor="middle"
                   transform={`rotate(-90, ${plotX - 8}, ${p.y})`}
                   fontSize="7"
                   fill={colors.text}
                   fontWeight="500"
                 >
                   {formatCoordLabel(lat, false)}
                 </text>
 
                 {/* Right Border Notation */}
                 <line x1={plotX + plotWidth} y1={p.y} x2={plotX + plotWidth + 4} y2={p.y} stroke={colors.stroke} strokeWidth="1" />
                 <text
                   x={plotX + plotWidth + 8}
                   y={p.y}
                   textAnchor="middle"
                   transform={`rotate(90, ${plotX + plotWidth + 8}, ${p.y})`}
                   fontSize="7"
                   fill={colors.text}
                   fontWeight="500"
                 >
                   {formatCoordLabel(lat, false)}
                 </text>
              </g>
            );
          })}
        </g>

        {/* Drag and drop: Legend Box Overlay */}
        {settings.showLegend && !hasRightPanel && (
          <g
            id="legend-overlay-group"
            transform={`translate(${legendX}, ${legendY})`}
            onMouseDown={(e) => handleMouseDown(e, 'legend')}
            className="cursor-move group"
          >
            {/* Soft highlight border when hovering */}
            <rect
              x="-6"
              y="-6"
              width="172"
              height={settings.legendType === 'choropleth' ? 34 + layers.filter(l => l.visible).length * 42 + 10 : 30 + legendItems.length * 16}
              fill="rgba(241, 245, 249, 0.4)"
              stroke="transparent"
              strokeDasharray="3 3"
              className="group-hover:stroke-blue-400 group-hover:fill-blue-50/10 rounded"
              rx="4"
            />
            
            {/* Main Legend Rectangle Box */}
            <rect
              x="0"
              y="0"
              width="160"
              height={settings.legendType === 'choropleth' ? 24 + layers.filter(l => l.visible).length * 42 + 8 : 18 + legendItems.length * 16}
              fill="white"
              stroke={colors.stroke}
              strokeWidth="1"
              rx="1"
            />
            {/* Legend Heading title */}
            <text x="8" y="14" fontSize="8" fontWeight="bold" fill={colors.text} className="academic-font uppercase tracking-wide">
              {settings.legendTitle || 'LEGENDA PETA'}
            </text>
            <line x1="0" y1="18" x2="160" y2="18" stroke={colors.stroke} strokeWidth="0.5" />
            
            {/* Legend Item contents based on type setting */}
            {settings.legendType === 'choropleth' ? (
              <g transform="translate(8, 22)">
                {layers.filter(l => l.visible).map((layer, lIdx) => {
                  if (layer.categoryField && layer.categoriesColorMap) {
                    const keys = Object.keys(layer.categoriesColorMap);
                    const minVal = keys[0] || 'Rendah';
                    const maxVal = keys[keys.length - 1] || 'Tinggi';
                    return (
                      <g key={`flo-leg-${layer.id}`} transform={`translate(0, ${lIdx * 42})`}>
                        <text x="0" y="8" fontSize="7.5" fontWeight="bold" fill={colors.text} className="academic-font">
                          {layer.name} ({layer.categoryField})
                        </text>
                        <rect
                          x="0"
                          y="12"
                          width="144"
                          height="10"
                          fill={`url(#layer-grad-${layer.id})`}
                          stroke={colors.stroke}
                          strokeWidth="0.8"
                        />
                        <text x="0" y="30" fontSize="7" fill={colors.text} className="academic-font">
                          {minVal}
                        </text>
                        <text x="144" y="30" fontSize="7" fill={colors.text} className="academic-font" textAnchor="end">
                          {maxVal}
                        </text>
                      </g>
                    );
                  } else {
                    return (
                      <g key={`flo-leg-solid-${layer.id}`} transform={`translate(0, ${lIdx * 42})`}>
                        <rect x="0" y="10" width="10" height="9" fill={layer.color} stroke={colors.stroke} strokeWidth="0.8" />
                        <text x="16" y="18" fontSize="7.5" fill={colors.text} className="academic-font">
                          {layer.name}
                        </text>
                      </g>
                    );
                  }
                })}
              </g>
            ) : (
              legendItems.map((item, idx) => (
                <g key={`legend-item-${idx}`} transform={`translate(8, ${24 + idx * 14})`}>
                  <rect x="0" y="0" width="10" height="9" fill={item.color} stroke={colors.stroke} strokeWidth="0.8" />
                  <text x="16" y="8" fontSize="7.5" fill={colors.text} className="academic-font">
                    {item.label}
                  </text>
                </g>
              ))
            )}
          </g>
        )}

        {/* Drag and drop: Scale Bar Block Overlay */}
        {settings.showScaleBar && !hasRightPanel && scaleWidthPx > 0 && (
          <g
            id="scale-bar-overlay-group"
            transform={`translate(${scaleX}, ${scaleY})`}
            onMouseDown={(e) => handleMouseDown(e, 'scale')}
            className="cursor-move group"
          >
            <rect
              x="-12"
              y="-12"
              width={scaleWidthPx + 24}
              height="34"
              fill="rgba(241, 245, 249, 0.4)"
              stroke="transparent"
              strokeDasharray="3 3"
              className="group-hover:stroke-blue-400 group-hover:fill-blue-50/10 rounded"
              rx="4"
            />
            
            {/* Scale Checker lines */}
            <path
              d={`M 0,4 L ${scaleWidthPx},4 M 0,0 L 0,8 M ${scaleWidthPx},0 L ${scaleWidthPx},8`}
              stroke={colors.stroke}
              strokeWidth="1.5"
              fill="none"
            />
            {/* Middle Tick and subdividers for professional academic look */}
            <line x1={scaleWidthPx / 2} y1="1" x2={scaleWidthPx / 2} y2="7" stroke={colors.stroke} strokeWidth="1" />
            <line x1={scaleWidthPx / 4} y1="2" x2={scaleWidthPx / 4} y2="6" stroke={colors.stroke} strokeWidth="0.5" />
            <line x1={(scaleWidthPx * 3) / 4} y1="2" x2={(scaleWidthPx * 3) / 4} y2="6" stroke={colors.stroke} strokeWidth="0.5" />

            {/* Alternating black/white block bar for visual standard */}
            <rect x="0" y="2" width={scaleWidthPx / 2} height="2.5" fill={colors.text} />
            <rect x={scaleWidthPx / 2} y="2" width={scaleWidthPx / 2} height="2.5" fill="none" stroke={colors.stroke} strokeWidth="0.5" />

            {/* Scale bar text indicators */}
            <text x="0" y="-3" fontSize="7" textAnchor="middle" className="mono-font" fill={colors.text}>0</text>
            <text x={scaleWidthPx / 2} y="-3" fontSize="7" textAnchor="middle" className="mono-font" fill={colors.text}>
              {(settings.scaleBarLengthKm / 2).toFixed(1).replace('.0', '')}
            </text>
            <text x={scaleWidthPx} y="-3" fontSize="7" textAnchor="middle" className="mono-font" fill={colors.text}>
              {settings.scaleBarLengthKm} {settings.scaleBarUnit}
            </text>
            
            <text x={scaleWidthPx / 2} y="16" fontSize="7" fontWeight="bold" textAnchor="middle" className="mono-font" fill={colors.text}>
              {calculateRepresentativeScale(bounds, layoutWidth, layoutHeight, settings)}
            </text>
          </g>
        )}

        {/* Drag and drop: North Arrow Symbol Overlay */}
        {settings.showNorthArrow && !hasRightPanel && (
          <g
            id="north-arrow-overlay-group"
            transform={`translate(${northX}, ${northY}) scale(${settings.northArrowScale})`}
            onMouseDown={(e) => handleMouseDown(e, 'north')}
            className="cursor-move group"
          >
            {/* Hover highlighting grid */}
            <rect
              x="-18"
              y="-32"
              width="36"
              height="52"
              fill="rgba(241, 245, 249, 0.4)"
              stroke="transparent"
              strokeDasharray="3 3"
              className="group-hover:stroke-blue-400 group-hover:fill-blue-50/10 rounded"
              rx="4"
            />
            
            {/* Draw active north arrow design style */}
            {settings.northArrowStyle === 'classic' && <use href="#north-arrow-classic" />}
            {settings.northArrowStyle === 'modern' && <use href="#north-arrow-modern" />}
            {settings.northArrowStyle === 'minimal' && <use href="#north-arrow-minimal" />}
          </g>
        )}

        {/* Render Custom Draggable Text Labels */}
        <g id="map-custom-labels">
          {labels.map((lbl) => {
            // Anchor can either be layout percents or projected latitude/longitude coordinates
            let drawX = (lbl.x / 100) * layoutWidth;
            let drawY = (lbl.y / 100) * layoutHeight;

            if (lbl.lat !== undefined && lbl.lng !== undefined) {
              const p = projectToMap(lbl.lng, lbl.lat);
              drawX = p.x;
              drawY = p.y;
            }

            // If the calculated position ends up outside map plot view, adjust if pinned
            const isOutside = drawX < plotX || drawX > plotX + plotWidth || drawY < plotY || drawY > plotY + plotHeight;

            // Anchor point dot representation
            const showPointDot = lbl.isUserAdded;

            return (
              <g
                key={`map-lbl-${lbl.id}`}
                transform={`translate(${drawX}, ${drawY})`}
                onMouseDown={(e) => handleMouseDown(e, 'label', lbl.id)}
                className="cursor-move group"
              >
                {/* Visual hover badge bounds */}
                <rect
                  x="-25"
                  y="-10"
                  width="50"
                  height="16"
                  fill="rgba(59, 130, 246, 0.1)"
                  stroke="rgba(59, 130, 246, 0.4)"
                  strokeWidth="0.5"
                  strokeDasharray="1 1"
                  className="opacity-0 group-hover:opacity-100 rounded"
                />
                
                {/* Tiny anchor ring to visually locate labels */}
                {showPointDot && !isOutside && (
                  <circle cx="0" cy="0" r="1.5" fill={colors.stroke} />
                )}

                <text
                  x="0"
                  y={showPointDot ? -5 : 0}
                  fontSize={lbl.fontSize}
                  fontWeight={lbl.fontWeight}
                  fill={lbl.color || colors.text}
                  textAnchor="middle"
                  className="academic-font shadow-sm drop-shadow-md select-none"
                  transform={`rotate(${lbl.angle})`}
                  style={{
                    paintOrder: 'strokeFill',
                    stroke: 'white',
                    strokeWidth: '1.5px',
                    strokeLinejoin: 'round',
                  }}
                >
                  {lbl.text}
                </text>
              </g>
            );
          })}
        </g>

        {/* SMALL CORNER INSET MAP (Lokasi Penelitian) */}
        {settings.showInsetMap && (
          <svg
            x={insetX}
            y={insetY}
            width={insetWidth}
            height={insetHeight}
            className="inset-map shadow-md"
            style={{ overflow: 'hidden' }}
          >
            {/* Background */}
            <rect x="0" y="0" width={insetWidth} height={insetHeight} fill="#f8fafc" stroke={colors.stroke} strokeWidth="1.2" />
            
            {/* Basemap in Inset if enabled */}
            {settings.showBasemap && (
              <g id="inset-basemap" opacity={settings.basemapOpacity * 0.95}>
                {getOSMTiles(insetBounds, insetWidth, insetHeight).map((tile, tIdx) => {
                  const tileMinLng = (tile.x / Math.pow(2, tile.z)) * 360 - 180;
                  const tileMaxLng = ((tile.x + 1) / Math.pow(2, tile.z)) * 360 - 180;
                  
                  const tileYToLatInset = (ty: number, tz: number) => {
                    const n = Math.PI - (2 * Math.PI * ty) / Math.pow(2, tz);
                    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
                  };
                  
                  const tileMaxLat = tileYToLatInset(tile.y, tile.z);
                  const tileMinLat = tileYToLatInset(tile.y + 1, tile.z);
                  
                  const topLeft = projectToInset(tileMinLng, tileMaxLat);
                  const bottomRight = projectToInset(tileMaxLng, tileMinLat);
                  
                  return (
                    <image
                      key={`inset-tile-${tile.z}-${tile.x}-${tile.y}-${tIdx}`}
                      href={getTileUrl(settings.basemapProvider || 'osm', tile.x, tile.y, tile.z)}
                      x={topLeft.x}
                      y={topLeft.y}
                      width={bottomRight.x - topLeft.x + 0.5}
                      height={bottomRight.y - topLeft.y + 0.5}
                      referrerPolicy="no-referrer"
                    />
                  );
                })}
              </g>
            )}

            {/* Inset features (Outlines of Study districts) */}
            <g id="inset-features">
              {layers.map((layer) => {
                if (!layer.visible) return null;
                return layer.features.map((feature, fIdx) => (
                  <path
                    key={`inset-feat-${layer.id}-${feature.id}-${fIdx}`}
                    d={renderPolygonPathInset(feature.geometry)}
                    fill="#475569"
                    fillOpacity="0.45"
                    stroke="#1e293b"
                    strokeWidth="0.5"
                  />
                ));
              })}
            </g>

            {/* Red Area of Interest rectangle indicating Study Area */}
            {(() => {
              const rectL = projectToInset(bounds.minLng, bounds.maxLat);
              const rectR = projectToInset(bounds.maxLng, bounds.minLat);
              const boxX = Math.min(rectL.x, rectR.x);
              const boxY = Math.min(rectL.y, rectR.y);
              const boxW = Math.max(2, Math.abs(rectR.x - rectL.x));
              const boxH = Math.max(2, Math.abs(rectR.y - rectL.y));
              return (
                <rect
                  x={boxX}
                  y={boxY}
                  width={boxW}
                  height={boxH}
                  fill="rgba(239, 68, 68, 0.25)"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                />
              );
            })()}

            {/* Label "INSET" overlay */}
            <rect x="2" y="120" width={insetWidth - 4} height="18" fill="rgba(255, 255, 255, 0.9)" stroke={colors.stroke} strokeWidth="0.5" />
            <text
              x={insetWidth / 2}
              y="131"
              textAnchor="middle"
              fontSize="6.5"
              fontWeight="bold"
              fill={colors.text}
              className="academic-font"
            >
              LOKASI PENELITIAN
            </text>
            
            {/* Border around the inset */}
            <rect x="0" y="0" width={insetWidth} height={insetHeight} fill="none" stroke={colors.stroke} strokeWidth="1.2" />
          </svg>
        )}

        {/* RIGHT SIDEBAR PANEL LAYOUT (Collected Peripheral Info) */}
        {hasRightPanel && (
          <g id="map-right-sidebar-panel" className="select-none">
            {/* Outer box of sidebar with standard single frame matching plot border */}
            <rect
              x={rightPanelX}
              y={rightPanelY}
              width={panelWidth}
              height={plotHeight}
              fill="white"
              stroke={colors.stroke}
              strokeWidth="1.5"
            />
            
            {/* Render title, subtitle, north arrow, scale bar, legend, source */}
            {(() => {
              let panelY = rightPanelY + 18;
              
              const titleLines = wrapSVGText(settings.title || 'PETA WILAYAH PENELITIAN', Math.floor(panelWidth / 7.2));
              const subtitleLines = settings.showSubtitle ? wrapSVGText(settings.subtitle || 'Proyeksi Mercator', Math.floor(panelWidth / 5.2)) : [];
              
              const calculatedElements: React.ReactNode[] = [];
              
              // 1. ADD TITLE & SUBTITLE
              calculatedElements.push(
                <g key="panel-title-block">
                  {titleLines.map((line, idx) => (
                    <text
                      key={`p-title-${idx}`}
                      x={rightPanelX + panelWidth / 2}
                      y={panelY + idx * 13}
                      fontSize="9.5"
                      fontWeight="bold"
                      textAnchor="middle"
                      fill={colors.text}
                      className="academic-font uppercase font-bold"
                    >
                      {line}
                    </text>
                  ))}
                  {subtitleLines.map((line, idx) => (
                    <text
                      key={`p-sub-${idx}`}
                      x={rightPanelX + panelWidth / 2}
                      y={panelY + titleLines.length * 13 + 5 + idx * 9}
                      fontSize="7"
                      textAnchor="middle"
                      fill={colors.stroke}
                      className="academic-font italic"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
              
              panelY += titleLines.length * 13 + (subtitleLines.length > 0 ? subtitleLines.length * 9 + 8 : 10);
              
              // Separator 1
              calculatedElements.push(
                <line key="sep-1" x1={rightPanelX} y1={panelY} x2={rightPanelX + panelWidth} y2={panelY} stroke={colors.stroke} strokeWidth="1" />
              );
              panelY += 16;
              
              // 2. ADD NORTH ARROW (Compass)
              if (settings.showNorthArrow) {
                const arrowY = panelY + 25;
                calculatedElements.push(
                  <g key="panel-arrow-block">
                    <g transform={`translate(${rightPanelX + panelWidth / 2}, ${arrowY}) scale(${settings.northArrowScale * 0.95})`}>
                      {settings.northArrowStyle === 'classic' && <use href="#north-arrow-classic" />}
                      {settings.northArrowStyle === 'modern' && <use href="#north-arrow-modern" />}
                      {settings.northArrowStyle === 'minimal' && <use href="#north-arrow-minimal" />}
                    </g>
                  </g>
                );
                panelY += 62;
                
                calculatedElements.push(
                  <line key="sep-2" x1={rightPanelX} y1={panelY} x2={rightPanelX + panelWidth} y2={panelY} stroke={colors.stroke} strokeWidth="1" />
                );
                panelY += 16;
              }
              
              // 3. SCALE BAR
              if (settings.showScaleBar && scaleWidthPx > 0) {
                calculatedElements.push(
                  <g key="panel-scale-block">
                    <g transform={`translate(${rightPanelX + (panelWidth - scaleWidthPx) / 2}, ${panelY + 12})`}>
                      <path
                        d={`M 0,4 L ${scaleWidthPx},4 M 0,0 L 0,8 M ${scaleWidthPx},0 L ${scaleWidthPx},8`}
                        stroke={colors.stroke}
                        strokeWidth="1.5"
                        fill="none"
                      />
                      <line x1={scaleWidthPx / 2} y1="1" x2={scaleWidthPx / 2} y2="7" stroke={colors.stroke} strokeWidth="1" />
                      <line x1={scaleWidthPx / 4} y1="2" x2={scaleWidthPx / 4} y2="6" stroke={colors.stroke} strokeWidth="0.5" />
                      <line x1={(scaleWidthPx * 3) / 4} y1="2" x2={(scaleWidthPx * 3) / 4} y2="6" stroke={colors.stroke} strokeWidth="0.5" />
                      <rect x="0" y="2" width={scaleWidthPx / 2} height="2.5" fill={colors.text} />
                      <rect x={scaleWidthPx / 2} y="2" width={scaleWidthPx / 2} height="2.5" fill="none" stroke={colors.stroke} strokeWidth="0.5" />
                      
                      <text x="0" y="-3" fontSize="6.5" textAnchor="middle" className="mono-font" fill={colors.text}>0</text>
                      <text x={scaleWidthPx / 2} y="-3" fontSize="6.5" textAnchor="middle" className="mono-font" fill={colors.text}>
                        {(settings.scaleBarLengthKm / 2).toFixed(1).replace('.0', '')}
                      </text>
                      <text x={scaleWidthPx} y="-3" fontSize="6.5" textAnchor="middle" className="mono-font" fill={colors.text}>
                        {settings.scaleBarLengthKm} {settings.scaleBarUnit}
                      </text>
                      <text x={scaleWidthPx / 2} y="15" fontSize="7" fontWeight="bold" textAnchor="middle" className="academic-font" fill={colors.text}>
                        SKALA GRAFIS
                      </text>
                      <text x={scaleWidthPx / 2} y="25" fontSize="7" fontWeight="bold" textAnchor="middle" className="mono-font" fill={colors.text}>
                        {calculateRepresentativeScale(bounds, layoutWidth, layoutHeight, settings)}
                      </text>
                    </g>
                  </g>
                );
                panelY += 46;
                
                calculatedElements.push(
                  <line key="sep-3" x1={rightPanelX} y1={panelY} x2={rightPanelX + panelWidth} y2={panelY} stroke={colors.stroke} strokeWidth="1" />
                );
                panelY += 16;
              }
              
              // 4. LEGEND BLOCK
              if (settings.showLegend) {
                calculatedElements.push(
                  <g key="panel-legend-header">
                    <text
                      x={rightPanelX + panelWidth / 2}
                      y={panelY + 4}
                      fontSize="8.5"
                      fontWeight="bold"
                      textAnchor="middle"
                      fill={colors.text}
                      className="academic-font font-bold uppercase tracking-wider"
                    >
                      {settings.legendTitle || 'LEGENDA PETA'}
                    </text>
                  </g>
                );
                panelY += 12;
                
                calculatedElements.push(
                  <g key="panel-legend-items" transform={`translate(${rightPanelX + 15}, ${panelY})`}>
                    {settings.legendType === 'choropleth' ? (
                      layers.filter(l => l.visible).map((layer, lIdx) => {
                        if (layer.categoryField && layer.categoriesColorMap) {
                          const keys = Object.keys(layer.categoriesColorMap);
                          const minVal = keys[0] || 'Rendah';
                          const maxVal = keys[keys.length - 1] || 'Tinggi';
                          return (
                            <g key={`panel-ch-leg-${layer.id}`} transform={`translate(0, ${lIdx * 34})`}>
                              <text x="0" y="0" fontSize="7" fontWeight="bold" fill={colors.text} className="academic-font">
                                {layer.name} ({layer.categoryField})
                              </text>
                              <rect
                                x="0"
                                y="4"
                                width={panelWidth - 30}
                                height="8"
                                fill={`url(#layer-grad-${layer.id})`}
                                stroke={colors.stroke}
                                strokeWidth="0.8"
                              />
                              <text x="0" y="20" fontSize="6.5" fill={colors.text} className="academic-font">
                                {minVal}
                              </text>
                              <text x={panelWidth - 30} y="20" fontSize="6.5" fill={colors.text} className="academic-font" textAnchor="end">
                                {maxVal}
                              </text>
                            </g>
                          );
                        } else {
                          return (
                            <g key={`panel-solid-leg-${layer.id}`} transform={`translate(0, ${lIdx * 34})`}>
                              <rect x="0" y="0" width="10" height="9" fill={layer.color} stroke={colors.stroke} strokeWidth="0.8" />
                              <text x="16" y="8" fontSize="7" fill={colors.text} className="academic-font">
                                {layer.name}
                              </text>
                            </g>
                          );
                        }
                      })
                    ) : (
                      legendItems.map((item, idx) => (
                        <g key={`panel-disc-leg-${idx}`} transform={`translate(0, ${idx * 13})`}>
                          <rect x="0" y="0" width="10" height="9" fill={item.color} stroke={colors.stroke} strokeWidth="0.8" />
                          <text x="16" y="8" fontSize="7.2" fill={colors.text} className="academic-font truncate" style={{ maxWidth: panelWidth - 45 }}>
                            {item.label}
                          </text>
                        </g>
                      ))
                    )}
                  </g>
                );
              }
              
              // 5. DATA SOURCE AT THE BOTTOM
              const sourceY = plotY + plotHeight - 34;
              calculatedElements.push(
                <g key="panel-sources-block" transform={`translate(${rightPanelX + 15}, ${sourceY})`}>
                  <line x1="-15" y1="-8" x2={panelWidth - 15} y2="-8" stroke={colors.stroke} strokeWidth="1" />
                  <text x="0" y="0" fontSize="7.5" fontWeight="bold" fill={colors.text} className="academic-font uppercase font-bold tracking-wide">
                    SUMBER DATA:
                  </text>
                  {wrapSVGText(settings.mapDataSource || 'Fakultas Geografi & BIG, 2026', Math.floor(panelWidth / 5.2)).map((line, idx) => (
                    <text
                      key={`panel-src-${idx}`}
                      x="0"
                      y={9 + idx * 8}
                      fontSize="6.5"
                      fill={colors.stroke}
                      className="academic-font italic"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
              
              return <React.Fragment>{calculatedElements}</React.Fragment>;
            })()}
          </g>
        )}

        {/* Clean Paper Border Layout framing */}
        <rect
          x="1"
          y="1"
          width={layoutWidth - 2}
          height={layoutHeight - 2}
          fill="none"
          stroke={colors.stroke}
          strokeWidth="1"
        />

        {/* Academic citation subtitle credit line strictly for publications */}
        {!settings.publicationNoCredit && (
          <text
            x={layoutWidth - 12}
            y={layoutHeight - 12}
            textAnchor="end"
            fontSize="6.5"
            className="mono-font opacity-40 text-slate-400"
            fill={colors.text}
          >
            Dibuat menggunakan Pembuat Peta Ilmiah Universitas
          </text>
        )}
      </svg>
      
      {/* Draggable hint helper */}
      <span className="absolute bottom-2 left-4 text-[10px] font-bold text-blue-800 bg-white/95 px-2.5 py-1.5 border border-blue-200 shadow-md select-none mono-font pointer-events-none uppercase tracking-wider">
        Petunjuk: Seret judul, legenda, kompas, skala, & teks untuk mengatur tata letak. Klik ganda poligon untuk detail.
      </span>
    </div>
  );
}
