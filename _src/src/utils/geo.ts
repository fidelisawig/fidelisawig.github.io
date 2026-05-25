/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeographicBounds, MapFeature, MapLayer, MapSettings } from '../types';

// Mercator projections
export function latToYProject(lat: number): number {
  // Clamp lat to avoid infinity
  const latClamped = Math.max(-85, Math.min(85, lat));
  const latRad = (latClamped * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
}

export function yToLatUnproject(y: number): number {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * (180 / Math.PI);
}

/**
 * Projects a geocoordinate (lng, lat) to cartesian space (x, y) based on bounds and dimensions.
 */
export function project(
  lng: number,
  lat: number,
  bounds: GeographicBounds,
  width: number,
  height: number,
  projection: 'Mercator' | 'Equirectangular' = 'Mercator'
): { x: number; y: number } {
  const { minLng, maxLng, minLat, maxLat } = bounds;

  if (projection === 'Mercator') {
    const minMercY = latToYProject(minLat);
    const maxMercY = latToYProject(maxLat);
    const rangeMercY = maxMercY - minMercY;
    const rangeLng = maxLng - minLng;

    const x = ((lng - minLng) / (rangeLng || 1)) * width;
    
    // Y is inverted in SVG/canvas coordinates
    const mercY = latToYProject(lat);
    const y = height - ((mercY - minMercY) / (rangeMercY || 1)) * height;

    return { x, y };
  } else {
    // Equirectangular (Simple lat/lng mapping)
    const rangeLng = maxLng - minLng;
    const rangeLat = maxLat - minLat;

    const x = ((lng - minLng) / (rangeLng || 1)) * width;
    const y = height - ((lat - minLat) / (rangeLat || 1)) * height;

    return { x, y };
  }
}

/**
 * Translates screen coordinates back to Geocoordinates (inverse projection)
 */
export function unproject(
  x: number,
  y: number,
  bounds: GeographicBounds,
  width: number,
  height: number,
  projection: 'Mercator' | 'Equirectangular' = 'Mercator'
): { lng: number; lat: number } {
  const { minLng, maxLng, minLat, maxLat } = bounds;

  if (projection === 'Mercator') {
    const minMercY = latToYProject(minLat);
    const maxMercY = latToYProject(maxLat);
    const rangeMercY = maxMercY - minMercY;
    const rangeLng = maxLng - minLng;

    const lng = (x / width) * rangeLng + minLng;
    
    // Invert SVG Y back
    const mercY = ((height - y) / height) * rangeMercY + minMercY;
    const lat = yToLatUnproject(mercY);

    return { lng, lat };
  } else {
    const rangeLng = maxLng - minLng;
    const rangeLat = maxLat - minLat;

    const lng = (x / width) * rangeLng + minLng;
    const lat = ((height - y) / height) * rangeLat + minLat;

    return { lng, lat };
  }
}

/**
 * Converts decimal degrees to Degrees-Minutes-Seconds (DMS) string in Indonesian representation.
 * For example: 106.827153 -> 106° 49' 37.75" BT
 */
export function decimalToDMS(val: number, isLng: boolean): string {
  const absolute = Math.abs(val);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.round((minutesNotTruncated - minutes) * 60 * 100) / 100;

  let suffix = '';
  if (isLng) {
    suffix = val >= 0 ? 'BT' : 'BB'; // Bujur Timur, Bujur Barat
  } else {
    suffix = val >= 0 ? 'LU' : 'LS'; // Lintang Utara, Lintang Selatan
  }

  // Formatting padding
  const secStr = seconds.toFixed(1);
  return `${degrees}° ${minutes}' ${secStr}" ${suffix}`;
}

/**
 * Haversine distance formula between two coordinates in meters
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculates how many pixels represent a specified Earth distance (e.g., 5 km) on the mapped panel.
 */
export function calculateDistanceInPixels(
  bounds: GeographicBounds,
  mapWidth: number,
  mapHeight: number,
  distanceMeters: number,
  projection: 'Mercator' | 'Equirectangular' = 'Mercator'
): number {
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const midLng = (bounds.minLng + bounds.maxLng) / 2;

  // Let's sample a small offset eastward at center
  // 1 degree longitude is approx 111.32 km * cos(lat) at equator
  const testLngOffset = distanceMeters / (111320 * Math.cos((midLat * Math.PI) / 180));
  const testLng = midLng + testLngOffset;

  const pCenter = project(midLng, midLat, bounds, mapWidth, mapHeight, projection);
  const pOffset = project(testLng, midLat, bounds, mapWidth, mapHeight, projection);

  // Euclidean screen distance for this longitudinal gap
  const dx = pOffset.x - pCenter.x;
  const dy = pOffset.y - pCenter.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Determines a reasonable scale bar length (e.g., 100m, 1km, 5km, 50km, 200km)
 * based on the map's current geographic span width.
 */
export function getRecommendedScaleLength(bounds: GeographicBounds): { length: number; unit: 'km' | 'm' } {
  const latCenter = (bounds.minLat + bounds.maxLat) / 2;
  const totalWidthMeters = haversineDistance(latCenter, bounds.minLng, latCenter, bounds.maxLng);

  if (totalWidthMeters < 1500) {
    // Under 1.5km width, show meters scale
    const mValue = totalWidthMeters / 4;
    if (mValue < 100) return { length: 50, unit: 'm' };
    if (mValue < 250) return { length: 100, unit: 'm' };
    if (mValue < 500) return { length: 250, unit: 'm' };
    return { length: 500, unit: 'm' };
  } else {
    const kmValue = totalWidthMeters / 1000 / 4;
    if (kmValue < 1) return { length: 1, unit: 'km' };
    if (kmValue < 2) return { length: 2, unit: 'km' };
    if (kmValue < 5) return { length: 5, unit: 'km' };
    if (kmValue < 10) return { length: 10, unit: 'km' };
    if (kmValue < 25) return { length: 25, unit: 'km' };
    if (kmValue < 50) return { length: 50, unit: 'km' };
    if (kmValue < 100) return { length: 100, unit: 'km' };
    if (kmValue < 250) return { length: 250, unit: 'km' };
    return { length: 500, unit: 'km' };
  }
}

/**
 * Custom ultra-resilient browser XML parser to handle KML files
 */
export function parseKMLToGeoJSON(kmlText: string): any {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
  const features: any[] = [];

  const placemarks = xmlDoc.getElementsByTagName('Placemark');
  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const nameEl = pm.getElementsByTagName('name')[0];
    const name = nameEl ? nameEl.textContent || `Wilayah ${i+1}` : `Wilayah ${i+1}`;
    
    // Read style if available
    const descriptionEl = pm.getElementsByTagName('description')[0];
    const description = descriptionEl ? descriptionEl.textContent || '' : '';

    // Extract Polygon
    const polygons = pm.getElementsByTagName('Polygon');
    if (polygons.length > 0) {
      for (let p = 0; p < polygons.length; p++) {
        const poly = polygons[p];
        const outerBoundary = poly.getElementsByTagName('outerBoundaryIs')[0];
        if (outerBoundary) {
          const coordinatesEl = outerBoundary.getElementsByTagName('coordinates')[0];
          if (coordinatesEl) {
            const coordStr = coordinatesEl.textContent || '';
            const coordinates = parseKMLCoordinateString(coordStr);
            if (coordinates.length > 0) {
              features.push({
                type: 'Feature',
                properties: { name, description },
                geometry: {
                  type: 'Polygon',
                  coordinates: [coordinates],
                },
              });
            }
          }
        }
      }
    }

    // Extract MultiGeometry details if any
    const multiGeoms = pm.getElementsByTagName('MultiGeometry');
    if (multiGeoms.length > 0) {
      const pmPolygons = pm.getElementsByTagName('Polygon');
      const rings: any[] = [];
      for (let p = 0; p < pmPolygons.length; p++) {
        const poly = pmPolygons[p];
        const outerBoundary = poly.getElementsByTagName('outerBoundaryIs')[0];
        if (outerBoundary) {
          const coordinatesEl = outerBoundary.getElementsByTagName('coordinates')[0];
          if (coordinatesEl) {
            const coordStr = coordinatesEl.textContent || '';
            const coordinates = parseKMLCoordinateString(coordStr);
            if (coordinates.length > 0) {
              rings.push(coordinates);
            }
          }
        }
      }
      if (rings.length > 0) {
        features.push({
          type: 'Feature',
          properties: { name, description },
          geometry: {
            type: 'MultiPolygon',
            coordinates: rings.map(ring => [ring]),
          },
        });
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

function parseKMLCoordinateString(coordStr: string): [number, number][] {
  const points: [number, number][] = [];
  const coordsTemp = coordStr.trim().split(/\s+/);
  for (const c of coordsTemp) {
    const parts = c.split(',');
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lng) && !isNaN(lat)) {
        points.push([lng, lat]);
      }
    }
  }
  return points;
}

/**
 * Computes a standardized representative scale (such as 1:25.000) for structural map views.
 */
export function calculateRepresentativeScale(
  bounds: GeographicBounds,
  layoutWidth: number,
  layoutHeight: number,
  settings: MapSettings
): string {
  const margin = settings.margin;
  const hasRightPanel = settings.layoutPeripheralPanel;
  
  const panelWidth = hasRightPanel ? Math.min(260, Math.max(160, layoutWidth * 0.23)) : 0;
  const plotY = margin + (hasRightPanel ? 15 : (settings.showTitle ? 60 : 20));
  const plotWidth = hasRightPanel
    ? Math.max(100, layoutWidth - panelWidth - margin * 2.5)
    : Math.max(100, layoutWidth - margin * 2);
  const plotHeight = Math.max(100, layoutHeight - plotY - margin);

  const scaleBarMeters = settings.scaleBarLengthKm * (settings.scaleBarUnit === 'km' ? 1000 : 1);
  const scaleWidthPx = calculateDistanceInPixels(
    bounds,
    plotWidth,
    plotHeight,
    scaleBarMeters,
    settings.projection
  );

  if (scaleWidthPx <= 0) return '1:--';
  const pxToMeters = scaleBarMeters / scaleWidthPx;
  // standard pixel physical size of 96 DPI CSS standard: 1 px = 0.264583 mm
  const scaleRatio = pxToMeters / 0.000264583;
  
  // Choose standard logical cartographic increments for scale representation
  let roundedScale = Math.round(scaleRatio);
  if (roundedScale > 10000000) {
    roundedScale = Math.round(roundedScale / 500000) * 500000;
  } else if (roundedScale > 5000000) {
    roundedScale = Math.round(roundedScale / 250000) * 250000;
  } else if (roundedScale > 1000000) {
    roundedScale = Math.round(roundedScale / 100000) * 100000;
  } else if (roundedScale > 500000) {
    roundedScale = Math.round(roundedScale / 50000) * 50000;
  } else if (roundedScale > 250000) {
    roundedScale = Math.round(roundedScale / 25000) * 25000;
  } else if (roundedScale > 100000) {
    roundedScale = Math.round(roundedScale / 10000) * 10000;
  } else if (roundedScale > 50000) {
    roundedScale = Math.round(roundedScale / 5000) * 5000;
  } else if (roundedScale > 25000) {
    roundedScale = Math.round(roundedScale / 2500) * 2500;
  } else if (roundedScale > 10000) {
    roundedScale = Math.round(roundedScale / 1000) * 1000;
  } else if (roundedScale > 5000) {
    roundedScale = Math.round(roundedScale / 500) * 500;
  } else if (roundedScale > 1000) {
    roundedScale = Math.round(roundedScale / 100) * 100;
  } else if (roundedScale > 500) {
    roundedScale = Math.round(roundedScale / 50) * 50;
  } else {
    roundedScale = Math.round(roundedScale / 10) * 10;
  }
  
  return `1:${roundedScale.toLocaleString('id-ID')}`;
}

