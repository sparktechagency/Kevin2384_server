import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { SessionModule } from './modules/session/session.module';
import mailerConfig from './config/mailer.config';
import { JwtGuard } from './modules/auth/guards/jwt.guard';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RefundModule } from './modules/refund/refund.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationModule } from './modules/notification/notification.module';
import { RolesGuard } from './common/guards/roles.guards';
import { PrivacyPolicyModule } from './modules/privacy_policy/privacy_policy.module';
import stripeConfig from './config/stripe.config';
import { ScheduleModule } from '@nestjs/schedule';
import awsConfig from './config/aws.config';
import { MulterModule } from '@nestjs/platform-express';
import { S3Storage } from './common/storage/s3-storage';
import { AwsModule } from './modules/aws/aws.module';
import { MulterConfigProvider } from './common/providres/multer.provider';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import jwtConfig from './config/jwt.config';
import firebaseConfig from './config/firebase.config';



@Module({
  imports: [
    ConfigModule.forRoot({isGlobal:true,load:[mailerConfig, stripeConfig, awsConfig, jwtConfig, firebaseConfig]}),
    // BullModule.forRoot({
    //   connection:{
    //     host:'localhost',
    //     port:6379
    //   }
    // }),

    UserModule,
    AuthModule,
    SessionModule,
    RefundModule,
    PaymentModule,
    ChatModule,
    NotificationModule,
    PrivacyPolicyModule,
    ScheduleModule.forRoot(),
    AwsModule,
    ThrottlerModule.forRoot({
      throttlers:[
        {
          ttl:60000,
          limit:20
        }
      ]
    }),
    DashboardModule
  ],
  
  controllers: [AppController],
  providers: [
    JwtService,
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    {
      provide:APP_GUARD,
      useClass: ThrottlerGuard
    }

  ],

})

export class AppModule {}
