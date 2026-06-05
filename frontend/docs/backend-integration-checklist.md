# Backend Integration Checklist

This frontend is now prepared to work with a real backend without removing mock data files.

## What is already done

- All UI hardcodes tied to one team (`t1`) were removed from runtime pages.
- Challenge report submit uses current user team id from auth context.
- Challenge report attachments no longer use `mock://...` values.
- Vite dev proxy now reads `VITE_BACKEND_URL` from `.env*` files correctly.
- Production env config is added with `VITE_USE_MOCK=false`.

## Required env values

For real backend mode:

```env
VITE_API_BASE=/api
VITE_USE_MOCK=false
```

For local dev with backend:

```env
VITE_BACKEND_URL=http://localhost:8080
VITE_API_BASE=/api
VITE_USE_MOCK=false
```

## Deploy notes

- Build uses `.env.production` by default.
- `VITE_USE_MOCK=false` in `.env.production`, so mock data does not affect production build.
- Keep nginx/reverse-proxy route for `/api/*` to backend service.

## Optional next step (when backend is ready)

- Replace report `fileUrls` (currently file names) with actual uploaded URLs/ids once backend file-upload endpoint is available.
