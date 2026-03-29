# Andrei Repo - Portfolio

A modern, responsive portfolio website for Andrei Repo, a Senior QA Engineer specializing in highly regulated iGaming. Built with Astro and Tailwind CSS.

## Features

- 🚀 Built with [Astro](https://astro.build/)
- 🎨 Styled with [Tailwind CSS](https://tailwindcss.com/)
- 📱 Fully responsive design
- 🌐 Internationalization support (EN/ES)
- 📦 Docker containerization ready
- 🚀 GitHub Actions CI/CD with automatic rollback

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
├── layouts/            # Layout templates
├── pages/              # Page routes
├── styles/             # Global styles
└── types/              # TypeScript definitions
```

## Content Sections

- **About**: Professional summary and QA engineering expertise
- **Experience**: Work history at Lottomart, Sketch, and Playtech
- **Projects**: Task Management Platform showcase
- **Contact**: Professional contact information with availability status

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

This portfolio uses Docker with Traefik for reverse proxy and automatic HTTPS via Let's Encrypt.

### GitHub Actions

The repository includes workflows for:
- Automated builds and testing
- Docker image building and pushing to GHCR
- Deployment to production server with automatic rollback on health check failure

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.