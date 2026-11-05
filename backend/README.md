# CUBE Vehicle Placement Backend

This backend is the secure bridge between the Android app and MongoDB Atlas.

## Architecture

Android App -> HTTPS REST API -> MongoDB Atlas -> future ERP integration

Do not put the MongoDB username/password or connection URI inside the Android APK.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` to the Atlas connection string.
3. Set `MONGODB_DB` if you want a different database name.
4. In MongoDB Atlas, allow the backend server's IP address in Network Access.
5. Run:

```bash
npm install
npm run check
npm start
```

## API

- `GET /health`
- `GET /api/bootstrap`
- `GET/POST/PUT /api/vehicles`
- `GET/POST/PUT /api/vendors`
- `GET/POST/PUT /api/locations`
- `GET/POST/PUT/DELETE /api/trips`
- `GET/PUT /api/fuel-rate`

Master renames cascade into existing trip references.
