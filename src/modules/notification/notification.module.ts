import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { FireBaseClient } from './providers/firebase.provider';

@Module({
    imports:[
    //     BullModule.registerQueue({
    //     name:NOTIFICATION_QUEUE,
    //     connection:{
    //         port:6379
    //     }
    // })
    ],
    controllers:[NotificationController],
    providers:[NotificationService, PrismaService, FireBaseClient],
    exports:[FireBaseClient]
})
export class NotificationModule {}
