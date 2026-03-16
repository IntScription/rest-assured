#!/usr/bin/env bash

set -e

echo "🚀 Deploying Gravity Log to Kubernetes..."

# Ensure kubectl works
echo "🔍 Checking Kubernetes connection..."
kubectl get nodes

# Apply secrets if local file exists
if [ -f infra/kubernetes/secret.local.yml ]; then
  echo "🔑 Applying local secrets..."
  kubectl apply -f infra/kubernetes/secret.local.yml
fi

echo "📦 Applying Kubernetes manifests..."
kubectl apply -f infra/kubernetes/deployment.yml
kubectl apply -f infra/kubernetes/service.yml

echo "🔄 Updating deployment image..."
kubectl set image deployment/gravity-log-web \
  gravity-log-web=ghcr.io/intscription/gravity-log-web:latest

echo "⏳ Waiting for rollout..."
kubectl rollout status deployment/gravity-log-web

echo "✅ Deployment successful!"

echo "🌐 Opening service..."
minikube service gravity-log-web-service
