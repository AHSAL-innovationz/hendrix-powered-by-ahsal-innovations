# Terraform remote state setup

This file documents how to create the S3 bucket and DynamoDB table used by Terraform remote state locking. Do NOT store terraform.tfvars in the repo.

Create S3 bucket (example AWS CLI):

aws s3api create-bucket --bucket <YOUR_TERRAFORM_STATE_BUCKET> --region us-west-1 --create-bucket-configuration LocationConstraint=us-west-1

Enable versioning and encryption:

aws s3api put-bucket-versioning --bucket <YOUR_TERRAFORM_STATE_BUCKET> --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket <YOUR_TERRAFORM_STATE_BUCKET> --server-side-encryption-configuration '{"Rule":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'

Create DynamoDB table for locks:

aws dynamodb create-table --table-name <YOUR_TERRAFORM_LOCK_TABLE> --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 --region us-west-1

Update infra/terraform/staging/backend.tf with the bucket & table names and commit that file (it contains placeholders currently).
