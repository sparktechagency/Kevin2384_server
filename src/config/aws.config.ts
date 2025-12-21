import { registerAs } from "@nestjs/config"

export const awsConfigData = (()=> ({
    access_key:process.env.AWS_ACCESS_KEY,
    secret_key:process.env.AWS_SECRET_KEY,
    bucket_name:process.env.S3_BUCKET_NAME,
    region:process.env.S3_BUCKET_REGION
}))

export default registerAs("aws", awsConfigData)