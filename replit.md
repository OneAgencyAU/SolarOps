# SolarOps

Solar operations management platform.

## Stack

- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Backend**: Node.js + Express + TypeScript (port 8000)
- **Runner**: `concurrently` runs both dev servers from one command

## Project Structure

```
/
├── client/             # React + Vite frontend
│   ├── index.html
│   └── src/
│       ├── main.tsx    # Entry point
│       ├── App.tsx     # Root component
│       ├── App.css
│       └── index.css
├── server/             # Express backend
│   └── src/
│       └── index.ts    # API server entry point
├── vite.config.ts      # Vite config (port 5000, proxy /api → 8000)
├── tsconfig.json       # TypeScript config for client
├── tsconfig.server.json # TypeScript config for server
└── package.json        # Scripts and dependencies
```

## Development

```bash
npm run dev        # Start both frontend and backend
npm run dev:client # Start Vite dev server only
npm run dev:server # Start Express server only (with watch)
```

## API

The Vite dev server proxies all `/api/*` requests to the Express server on port 8000.

- `GET /api/health` — health check
