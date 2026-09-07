terraform {
  backend "s3" {
    bucket = "<YOUR_TERRAFORM_STATE_BUCKET>" # replace with your state bucket
    key    = "hendrix/staging/terraform.tfstate"
    region = "us-west-1"
    dynamodb_table = "<YOUR_TERRAFORM_LOCK_TABLE>" # replace with your DynamoDB lock table
    encrypt = true
  }
}
