# ISER

Monorepo scaffold for the IoT Semantic Entity Resolver.

## Apps

- `apps/web`: React + TypeScript admin UI.
- `apps/api`: Express + TypeScript API with MongoDB models and clustering workflow.
- `packages/shared`: shared DTOs and domain types.

## Core flow built

- Admin can list clients from MongoDB.
- Clicking a client loads its sites.
- Clicking a site loads datapoints and existing clusters.
- Admin can run clustering for a site.
- Generated room and device clusters can be approved, rejected, or renamed.
- OpenAI metadata extraction is wired in, with a heuristic fallback when no API key is configured.

## Local setup

1. Install dependencies from the repo root:

```bash
npm install
```

2. Copy env files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

3. Start MongoDB locally.

4. Run the apps:

```bash
npm run dev
```

The API seeds a small development dataset automatically when `NODE_ENV=development` and the database is empty.

## Initial API surface

- `GET /api/admin/clients`
- `GET /api/admin/clients/:clientId`
- `GET /api/admin/sites/:siteId`
- `POST /api/admin/sites/:siteId/clusters/run`
- `PATCH /api/admin/clusters/:clusterId`

## Notes

- Authentication and authorization are intentionally deferred.
- The current clustering flow is the first core slice, not the final production pipeline.
- The next major step should be ingesting CSV uploads into `datapoints`, then improving the clustering review workflow and audit history.
