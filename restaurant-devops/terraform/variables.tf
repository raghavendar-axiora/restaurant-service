variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS deployment region"
}

variable "db_password" {
  type        = string
  default     = "securepassword123"
  description = "RDS Database Password"
  sensitive   = true
}

variable "eks_role_arn" {
  type        = string
  description = "ARN for the EKS Cluster Service Role"
}
