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
import { MulterModule } from '@nestjs/platform-express';
import { AwsModule } from '../aws/aws.module';
import multerS3 from 'multer-s3'

@Module({
    imports:[RefundModule, UserModule, 
        MulterModule.registerAsync({
            imports:[AwsModule],
            useFactory:(s3Storage:S3Storage)=> ({
                storage: multerS3({
                s3: s3Storage.getClient(),
                bucket: 'kevin2384-s3-bucket',
                // acl: 'public-read', // optional
                key: (req, file, cb) => {
                    cb(null, `${Date.now()}-${file.originalname}`);
                },
        }),
            }),
            inject:[S3Storage]
        })
    ],
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
