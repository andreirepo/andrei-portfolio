#!/bin/bash

# Andrei Repo Portfolio - AWS Lightsail Deployment Script
# This script helps deploy your portfolio to AWS Lightsail

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="andrei-portfolio"
CONTAINER_NAME="portfolio"
IMAGE_TAG="latest"
AWS_REGION="us-east-1" # Change to your preferred region

echo -e "${BLUE}🚀 Andrei Repo Portfolio - AWS Lightsail Deployment${NC}"
echo -e "${BLUE}======================================================${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    echo "Download: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install it first.${NC}"
    echo "Download: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Function to check if Lightsail service exists
check_service_exists() {
    echo -e "${YELLOW}🔍 Checking if Lightsail service exists...${NC}"
    if aws lightsail get-container-services --service-name "$SERVICE_NAME" --region "$AWS_REGION" &> /dev/null; then
        echo -e "${GREEN}✅ Lightsail service '$SERVICE_NAME' exists${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Lightsail service '$SERVICE_NAME' does not exist${NC}"
        return 1
    fi
}

# Function to create Lightsail service
create_service() {
    echo -e "${YELLOW}🏗️  Creating Lightsail service...${NC}"
    
    # Create the container service
    aws lightsail create-container-service \
        --service-name "$SERVICE_NAME" \
        --power micro \
        --scale 1 \
        --region "$AWS_REGION"
    
    echo -e "${GREEN}✅ Lightsail service created successfully${NC}"
    
    # Wait for service to be ready
    echo -e "${YELLOW}⏳ Waiting for service to be ready...${NC}"
    aws lightsail wait container-service-created --service-name "$SERVICE_NAME" --region "$AWS_REGION"
    
    echo -e "${GREEN}✅ Service is ready${NC}"
}

# Function to build and push Docker image
build_and_push_image() {
    echo -e "${YELLOW}🔨 Building Docker image...${NC}"
    
    # Build the image
    docker build -t "$CONTAINER_NAME:$IMAGE_TAG" .
    
    # Tag for AWS ECR (optional, if using ECR)
    # docker tag "$CONTAINER_NAME:$IMAGE_TAG" "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$CONTAINER_NAME:$IMAGE_TAG"
    
    echo -e "${GREEN}✅ Docker image built successfully${NC}"
}

# Function to deploy to Lightsail
deploy_to_lightsail() {
    echo -e "${YELLOW}🚀 Deploying to Lightsail...${NC}"
    
    # Deploy to Lightsail
    aws lightsail put-container-services-deployment \
        --service-name "$SERVICE_NAME" \
        --containers "[
            {
                \"name\": \"$CONTAINER_NAME\",
                \"image\": \"$CONTAINER_NAME:$IMAGE_TAG\",
                \"environment\": {
                    \"NODE_ENV\": \"production\"
                },
                \"ports\": {
                    \"80\": \"HTTP\"
                }
            }
        ]" \
        --public-endpoint "{
            \"healthCheckPath\": \"/health\",
            \"containerName\": \"$CONTAINER_NAME\",
            \"containerPort\": 80
        }" \
        --region "$AWS_REGION"
    
    echo -e "${GREEN}✅ Deployment initiated${NC}"
    
    # Wait for deployment
    echo -e "${YELLOW}⏳ Waiting for deployment to complete...${NC}"
    sleep 60
    
    # Check deployment status
    echo -e "${YELLOW}🔍 Checking deployment status...${NC}"
    aws lightsail get-container-services --service-name "$SERVICE_NAME" --region "$AWS_REGION"
    
    echo -e "${GREEN}✅ Deployment completed${NC}"
}

# Function to get service URL
get_service_url() {
    echo -e "${YELLOW}🌐 Getting service URL...${NC}"
    
    URL=$(aws lightsail get-container-services --service-name "$SERVICE_NAME" --region "$AWS_REGION" --query "containerServices[0].url" --output text)
    
    echo -e "${GREEN}🎉 Your portfolio is live at: $URL${NC}"
    echo -e "${BLUE}💡 Don't forget to set up a custom domain if needed${NC}"
}

# Function to show health check
health_check() {
    echo -e "${YELLOW}🏥 Performing health check...${NC}"
    
    URL=$(aws lightsail get-container-services --service-name "$SERVICE_NAME" --region "$AWS_REGION" --query "containerServices[0].url" --output text)
    
    if curl -f "$URL/health" &> /dev/null; then
        echo -e "${GREEN}✅ Health check passed${NC}"
    else
        echo -e "${RED}❌ Health check failed${NC}"
        echo "Please check the deployment logs"
    fi
}

# Main deployment flow
main() {
    echo -e "${BLUE}Starting deployment process...${NC}"
    
    # Build Docker image
    build_and_push_image
    
    # Check if service exists, create if needed
    if ! check_service_exists; then
        create_service
    fi
    
    # Deploy to Lightsail
    deploy_to_lightsail
    
    # Get service URL
    get_service_url
    
    # Perform health check
    health_check
    
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${BLUE}Your portfolio is now live on AWS Lightsail!${NC}"
}

# Handle script arguments
case "${1:-}" in
    "create-service")
        create_service
        ;;
    "deploy")
        build_and_push_image
        deploy_to_lightsail
        get_service_url
        health_check
        ;;
    "health-check")
        health_check
        ;;
    "url")
        get_service_url
        ;;
    *)
        main
        ;;
esac