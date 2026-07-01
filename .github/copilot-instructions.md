# Copilot Instructions

This repo contains two separate areas:
- Root static portfolio site: `index.html`, `projects.html`, and `images/`
- Interactive map designer app: `_src/` with a Vite + React + TypeScript workspace

## Primary focus
- Work in `_src/` for the main application logic.
- Use `App.tsx`, `components/Sidebar.tsx`, and `components/MapCanvas.tsx` as the main entry points.
- Preserve the existing map-oriented domain model defined in `_src/src/types.ts`.

## Key files and responsibilities
- `_src/src/App.tsx`: root app state, default Indonesian presets, bounds, labels, export modal, and main app wiring.
- `_src/src/components/Sidebar.tsx`: file upload, GeoPackage/KML/GeoJSON handling, Neon DB search integration, preset switching, and settings panel.
- `_src/src/components/MapCanvas.tsx`: SVG rendering, Mercator/Equirectangular projection, graticules, OSM/hillshade basemap tiles, draggable legend/scale/north arrow, labels, inset map, and export target.
- `_src/src/utils/geo.ts`: projection math, coordinate conversion, DMS formatting, scale recommendation, and GeoJSON/KML parsing.
- `_src/src/utils/gpkg.ts`: dynamic GeoPackage file parsing using `@ngageoint/geopackage` and `sql-wasm.wasm`.
- `_src/src/utils/db.ts`: Neon database geometry lookup and local storage config.
- `_src/vite.config.ts`: base path is set to `/wilayahstudi/` and includes custom WASM serving/copying logic for GeoPackage support.

## Project conventions
- The app is heavily driven by the `MapSettings` and `MapLayer` shape in `_src/src/types.ts`.
- Default sample data lives in `_src/src/components/IndonesianPresets.ts`.
- `Sidebar.tsx` is the authoritative place for data ingestion: file uploads, DB queries, and preset loading.
- `MapCanvas.tsx` must keep projections and layout math consistent with `utils/geo.ts`.
- Use `settings.layoutTemplate` and `LAYOUTS` to keep export dimensions predictable.

## Build and local dev
- Change into `_src/` before running commands.
- Install dependencies: `npm install`
- Run development server: `npm run dev`
- Build production bundle: `npm run build`
- Preview build: `npm run preview`
- Validate TS only: `npm run lint`

## Important integration notes
- GeoPackage import requires `sql-wasm.wasm` to be served from `/sql-wasm.wasm`; `vite.config.ts` makes this available in dev and copies it into `dist/`.
- Database search uses `@neondatabase/serverless` and reads configuration from local storage and optionally `VITE_NEON_DATABASE_URL`.
- `Sidebar` stores DB URL and table config in browser local storage (`wilayahstudi_neon_url`, `wilayahstudi_db_config`).
- This repo has no automated test suite or dedicated root-level build script outside `_src/package.json`.

## What not to do
- Do not assume the root `index.html` / `projects.html` pages are part of the React app.
- Do not break the `base: '/wilayahstudi/'` assumption in `_src/vite.config.ts` without also updating deployment routing.
- Avoid changing projection helpers in `utils/geo.ts` unless the coordinate transform semantics are clearly preserved.

If any section is unclear or missing, I can refine the instructions with more detail on the interactive map workflow or build/deployment expectations.