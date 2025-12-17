import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { BullModule } from '@nestjs/bullmq';
import { NOTIFICATION_QUEUE } from './constants/constants';

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
    providers:[NotificationService, PrismaService]
})
export class NotificationModule {}
