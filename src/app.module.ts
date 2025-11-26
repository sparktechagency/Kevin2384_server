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


@Module({
  imports: [
    ConfigModule.forRoot({isGlobal:true,load:[mailerConfig]}),
    UserModule,
    AuthModule,
    SessionModule,
    RefundModule,
    PaymentModule,
    ChatModule,
    NotificationModule
  ],
  controllers: [AppController],
  providers: [
    JwtService,
    { provide: APP_GUARD, useClass: JwtGuard },
    
  ],

  
})
export class AppModule {}
