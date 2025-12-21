import { Module } from '@nestjs/common';
import { S3Storage } from 'src/common/storage/s3-storage';

@Module({
    imports:[],
    providers:[S3Storage],
    exports:[S3Storage]
})
export class AwsModule {}
