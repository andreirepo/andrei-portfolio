# Andrei Repo - Portfolio

A modern, responsive portfolio website for Andrei Repo, a Senior QA Engineer specializing in highly regulated iGaming. Built with Astro and Tailwind CSS.

## Features

- 🚀 Built with [Astro](https://astro.build/)
- 🎨 Styled with [Tailwind CSS](https://tailwindcss.com/)
- 📱 Fully responsive design
- 🌐 Internationalization support (EN/ES)
- 🐳 Docker containerization
- ⚡ Self-hosted CI/CD via GitHub Actions + SSH

## About

This portfolio showcases the professional experience and skills of Andrei Repo, a Senior QA Engineer with expertise in:

- Test Automation (Playwright, Cypress, WebdriverIO)
- Cloud & DevOps (AWS, Docker, GitHub Actions, Jenkins)
- Quality Assurance in regulated iGaming environments
- API testing and performance monitoring

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- pnpm (version 9 or higher)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd andrei-portfolio
```

2. Install dependencies:
```bash
pnpm install
```

3. Start the development server:
```bash
pnpm dev
```

4. Open your browser and navigate to `http://localhost:4321`

## Project Structure

```
src/
├── components/          # Astro components
├── layouts/             # Layout templates
├── pages/               # Page routes
├── content/             # Blog posts (EN/ES)
├── styles/              # Global styles
└── types/               # TypeScript definitions
```

## Content Sections

- **About**: Professional summary and QA engineering expertise
- **Experience**: Work history at Open Assessment Technologies, Lottomart, and Sketch
- **Projects**: Task Management Platform showcase
- **Blog**: Technical articles in English and Spanish

## Docker Setup

### Build the Docker image:
```bash
docker build -t andrei-portfolio .
```

### Run the container:
```bash
docker run -p 80:80 andrei-portfolio
```

## Deployment

The site is self-hosted behind [Traefik](https://traefik.io/) as a reverse proxy, with HTTPS handled via Let's Encrypt and DNS managed through Cloudflare.

### CI/CD Pipeline (GitHub Actions)

On every push to `main`, the pipeline:

1. Builds and type-checks the app
2. Builds and pushes a Docker image to GHCR
3. SSHs into the production server and runs `docker compose up`
4. Verifies the site is live via an external health check
5. Purges the Cloudflare cache
6. Rolls back automatically if the health check fails

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `SSH_PRIVATE_KEY` | Private key for SSH access to the server |
| `SERVER_USER` | SSH username |
| `SERVER_HOST` | Server hostname or IP |
| `CLOUDFLARE_ZONE_ID` | Cloudflare zone ID for cache purging |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
