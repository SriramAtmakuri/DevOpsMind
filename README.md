# DevOpsMind

AI-powered DevOps command center for real-time server monitoring, container management, and automated deployments.

---

## Features

- **Server Monitoring** — Live CPU, memory, disk, and load metrics via SSH with historical charts
- **Container Management** — Start, stop, restart, and inspect Docker containers across servers
- **Deployments** — Git-based deployments with Docker, direct, and Kubernetes strategies; one-click rollback
- **AI Assistant** — Conversational DevOps agent with live tool access (run commands, inspect containers, analyze logs)
- **Alert Rules** — Threshold-based alerts for CPU/memory/disk with acknowledge and resolve workflow
- **Encrypted Credentials** — SSH passwords and private keys stored with AES-256-GCM encryption

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Zustand, Recharts, Socket.io-client |
| Backend | Node.js, Express, Socket.io |
| Database | SQLite (better-sqlite3) |
| Auth | JWT, bcrypt |
| Infrastructure | SSH (node-ssh), Docker (dockerode), simple-git |
| AI | OpenAI-compatible API (Ollama / any local model) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A running AI model endpoint (Ollama recommended)

### Install

```bash
# Install all dependencies
npm run setup
```

### Configure

```bash
cp .env.example .env
```

Edit `.env` — required fields:

```env
JWT_SECRET=<long-random-string>   # generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AI_API_URL=<your-model-endpoint>
AI_MODEL=<model-name>
```

Optional — set default user passwords before first run, otherwise random passwords are generated and printed to console:

```env
ADMIN_PASSWORD=your_admin_password
GUEST_PASSWORD=your_guest_password
```

### Run

```bash
# Development (frontend + backend concurrently)
npm run dev

# Production
npm run build
npm start
```

---

## Project Structure

```
DevOpsMind/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── pages/   # Dashboard, Servers, Metrics, Containers, Deployments, Alerts, Chat
│       ├── store/   # Zustand state (auth, toast)
│       └── components/
├── server/          # Express backend
│   ├── routes/      # REST API endpoints
│   ├── services/    # SSH, Docker, AI, Metrics, Deployment logic
│   ├── middleware/  # JWT authentication
│   └── database/   # SQLite schema, migrations, seed data
└── .github/
    └── workflows/   # CI — lint, build, Docker image
```

---

## Security

- SSH credentials encrypted at rest (AES-256-GCM, key derived from `JWT_SECRET`)
- JWT authentication on all API routes and WebSocket connections
- Rate limiting on auth endpoints
- No secrets committed — `.env` and `*.db` are gitignored

---

## License

MIT
