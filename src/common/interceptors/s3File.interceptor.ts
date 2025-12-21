import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { S3Storage } from '../storage/s3-storage';

@Injectable()
export class S3FileInterceptor implements NestInterceptor {
  private interceptor;

  constructor(private readonly s3Storage: S3Storage) {
    this.interceptor = FileInterceptor('file', {
      storage: this.s3Storage.getStorage(),
    });
  }

  intercept(context: ExecutionContext, next: CallHandler) {
    return this.interceptor.intercept(context, next)
  }
}
