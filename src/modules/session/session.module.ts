import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { SessionBuilder } from './providers/SessionBuilder.provider';
import { PrismaService } from '../prisma/prisma.service';
import { CoachCancelStrategy } from './strategies/CoachCancelStrategy';
import { PlayerCancelStrategy } from './strategies/PlayerCancelStrategy';
import { RefundModule } from '../refund/refund.module';
import { UserService } from '../user/user.service';
import { UserModule } from '../user/user.module';
import { SessionScheduler } from './scheduler/session.scheduler';
import { PaymentService } from '../payment/payment.service';
import { StripeProvider } from '../payment/providers/stripe.provider';
import { NotificationService } from '../notification/notification.service';
import { SessionNotifier } from './providers/SessionNotifier.provider';
import { S3Storage } from 'src/common/storage/s3-storage';

@Module({
    imports:[RefundModule, UserModule],
    controllers:[SessionController],
    providers:[
        SessionService,
        SessionBuilder,
        PrismaService,
        SessionScheduler,
        PaymentService,
        StripeProvider,
        NotificationService,
        SessionNotifier,
        {
            provide: CoachCancelStrategy.INJECTION_KEY,
            useClass: CoachCancelStrategy
        },
        {
            provide: PlayerCancelStrategy.INJECTION_KEY,
            useClass: PlayerCancelStrategy
        }
    ]
})


export class SessionModule {}
