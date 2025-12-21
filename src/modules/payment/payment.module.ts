import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeProvider } from './providers/stripe.provider';
import { PayoutScheduler } from './scheduler/payouts.scheduler';
import { NotificationService } from '../notification/notification.service';

@Module({
    providers:[PrismaService, PaymentService, StripeProvider, PayoutScheduler, NotificationService],
    controllers:[PaymentController],
    exports:[PaymentService, StripeProvider]
    
})
export class PaymentModule {}
