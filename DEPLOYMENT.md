# Andrei Repo Portfolio - Deployment Guide

This guide provides comprehensive instructions for deploying your portfolio to AWS Lightsail and setting up the CI/CD pipeline.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Docker Setup](#docker-setup)
4. [AWS Lightsail Deployment](#aws-lightsail-deployment)
5. [GitHub Actions CI/CD](#github-actions-cicd)
6. [Manual Deployment](#manual-deployment)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Node.js** (version 18 or higher)
- **pnpm** (version 9 or higher)
- **Docker** (for containerization)
- **AWS CLI** (for Lightsail management)
- **Git** (for version control)

### AWS Account Setup

1. Create an AWS account if you don't have one
2. Install and configure AWS CLI:
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, region, and output format
   ```

## Local Development

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Development Server

```bash
pnpm dev
```

Your portfolio will be available at `http://localhost:4321`

### 3. Build for Production

```bash
pnpm build
```

The built files will be in the `dist/` directory.

## Docker Setup

### Build Docker Image

```bash
docker build -t andrei-portfolio .
```

### Run Docker Container Locally

```bash
docker run -p 3000:80 andrei-portfolio
```

Your portfolio will be available at `http://localhost:3000`

### Test Docker Image

```bash
# Test the health endpoint
curl http://localhost:3000/health

# Test the main page
curl http://localhost:3000
```

## AWS Lightsail Deployment

### 1. Create Lightsail Container Service

Using the deployment script:

```bash
./deploy.sh create-service
```

Or manually via AWS CLI:

```bash
aws lightsail create-container-service \
    --service-name andrei-portfolio \
    --power micro \
    --scale 1 \
    --region us-east-1
```

### 2. Deploy Your Application

Using the deployment script:

```bash
./deploy.sh deploy
```

Or manually via AWS CLI:

```bash
aws lightsail put-container-services-deployment \
    --service-name andrei-portfolio \
    --containers '[
        {
            "name": "portfolio",
            "image": "andrei-portfolio:latest",
            "environment": {
                "NODE_ENV": "production"
            },
            "ports": {
                "80": "HTTP"
            }
        }
    ]' \
    --public-endpoint '{
        "healthCheckPath": "/health",
        "containerName": "portfolio",
        "containerPort": 80
    }'
```

### 3. Get Your Service URL

```bash
./deploy.sh url
```

### 4. Health Check

```bash
./deploy.sh health-check
```

## GitHub Actions CI/CD

### 1. Repository Secrets

Add the following secrets to your GitHub repository:

- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
- `AWS_REGION`: Your AWS region (e.g., `us-east-1`)
- `LIGHTSAIL_SERVICE_NAME`: Your Lightsail service name (e.g., `andrei-portfolio`)
- `LIGHTSAIL_URL`: Your Lightsail service URL

### 2. Workflow Triggers

The CI/CD pipeline will automatically:

- **On push/PR to main/master**: Build, test, and deploy
- **Build and Test**: Run pnpm build, type checking, and i18n validation
- **Docker Build**: Build and push multi-platform Docker images
- **Deploy**: Deploy to AWS Lightsail
- **Health Check**: Verify deployment success

### 3. Manual Workflow Trigger

You can manually trigger the workflow from the GitHub Actions tab.

## Manual Deployment

### Using the Deployment Script

The `deploy.sh` script provides several commands:

```bash
# Full deployment
./deploy.sh

# Create service only
./deploy.sh create-service

# Deploy only
./deploy.sh deploy

# Health check only
./deploy.sh health-check

# Get service URL
./deploy.sh url
```

### Manual AWS CLI Commands

1. **Build Docker image**:
   ```bash
   docker build -t andrei-portfolio .
   ```

2. **Create Lightsail service** (if not exists):
   ```bash
   aws lightsail create-container-service \
       --service-name andrei-portfolio \
       --power micro \
       --scale 1 \
       --region us-east-1
   ```

3. **Deploy to Lightsail**:
   ```bash
   aws lightsail put-container-services-deployment \
       --service-name andrei-portfolio \
       --containers '[
           {
               "name": "portfolio",
               "image": "andrei-portfolio:latest",
               "environment": {
                   "NODE_ENV": "production"
               },
               "ports": {
                   "80": "HTTP"
               }
           }
       ]' \
       --public-endpoint '{
           "healthCheckPath": "/health",
           "containerName": "portfolio",
           "containerPort": 80
       }'
   ```

4. **Monitor deployment**:
   ```bash
   aws lightsail get-container-services --service-name andrei-portfolio
   ```

## Monitoring and Maintenance

### Health Monitoring

- **Health Endpoint**: `https://your-service-url/health`
- **Status Check**: Use `./deploy.sh health-check` to verify service health

### Logs and Monitoring

Access Lightsail container service logs via AWS Console or CLI:

```bash
aws lightsail get-container-service-deployments \
    --service-name andrei-portfolio \
    --region us-east-1
```

### Updates and Maintenance

1. **Code Changes**: Push to main/master branch triggers automatic deployment
2. **Manual Updates**: Use `./deploy.sh deploy` for manual deployments
3. **Service Scaling**: Adjust scale in Lightsail console if needed

### Backup Strategy

- **Code**: GitHub repository serves as primary backup
- **Configuration**: All deployment scripts and configurations are versioned
- **Service State**: Lightsail service configuration is managed via CLI/scripts

## Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Check build logs
pnpm build

# Verify dependencies
pnpm install --frozen-lockfile

# Check TypeScript errors
pnpm check
```

#### 2. Docker Issues
```bash
# Check Docker build
docker build -t andrei-portfolio .

# Test locally
docker run -p 3000:80 andrei-portfolio

# Check container logs
docker logs <container-id>
```

#### 3. Lightsail Deployment Issues
```bash
# Check service status
aws lightsail get-container-services --service-name andrei-portfolio

# Check deployment status
aws lightsail get-container-service-deployments --service-name andrei-portfolio

# Verify container logs
aws lightsail get-container-service-logs --service-name andrei-portfolio --container-name portfolio
```

#### 4. GitHub Actions Failures
- Check workflow logs in GitHub Actions tab
- Verify repository secrets are correctly set
- Ensure AWS credentials have necessary permissions

### AWS Permissions

Ensure your AWS IAM user has the following permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "lightsail:CreateContainerService",
                "lightsail:GetContainerServices",
                "lightsail:PutContainerServicesDeployment",
                "lightsail:GetContainerServiceDeployments",
                "lightsail:GetContainerServiceLogs"
            ],
            "Resource": "*"
        }
    ]
}
```

### Network and Security

- **Firewall**: Lightsail container services are publicly accessible by default
- **HTTPS**: Lightsail provides automatic HTTPS via Let's Encrypt
- **Health Checks**: Configure health check path as `/health`

### Performance Optimization

- **Caching**: Static assets are cached for 1 year
- **Compression**: Gzip compression is enabled
- **CDN**: Consider using CloudFront for global distribution if needed

## Support

For additional support:

1. Check the [AWS Lightsail Documentation](https://docs.aws.amazon.com/lightsail/)
2. Review [Astro Documentation](https://docs.astro.build/)
3. Check [GitHub Actions Documentation](https://docs.github.com/en/actions)
4. Open an issue in this repository for portfolio-specific questions

## Next Steps

1. **Custom Domain**: Set up a custom domain in Lightsail console
2. **SSL Certificate**: Lightsail provides automatic SSL, but you can upload custom certificates
3. **Monitoring**: Set up CloudWatch alarms for monitoring
4. **Backup**: Implement regular backup strategies for your service
5. **Scaling**: Monitor usage and scale your Lightsail service as needed