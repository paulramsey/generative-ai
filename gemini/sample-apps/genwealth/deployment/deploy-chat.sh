#!/usr/bin/env bash

# Load env variables
source ./env.sh

# pubsub access for Cloud Function GCS trigger
echo "Adding function permissions"
gcloud projects add-iam-policy-binding genwealth-magic \
      --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
      --role="roles/alloydb.client"

gcloud projects add-iam-policy-binding genwealth-magic \
      --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
      --role="roles/alloydb.databaseUser"

gcloud projects add-iam-policy-binding genwealth-magic \
      --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
      --role="roles/serviceusage.serviceUsageConsumer"

# Create function
# jscpd:ignore-start
echo "Creating Cloud Function: alloydb-webhook"
gcloud functions deploy alloydb-webhook \
  --region="${REGION}" \
  --runtime=python311 \
  --source="./function-scripts/alloydb-webhook" \
  --entry-point="alloydb_webhook" \
  --set-env-vars="REGION=${REGION},PROJECT_ID=${PROJECT_ID}" \
  --set-secrets "ALLOYDB_PASSWORD=alloydb-password-${PROJECT_ID}:1" \
  --egress-settings=private-ranges-only \
  --vpc-connector=vpc-connector \
  --timeout=60s \
  --max-instances=100 \
  --ingress-settings=all \
  --memory=1gi \
  --trigger-http

# jscpd:ignore-end
