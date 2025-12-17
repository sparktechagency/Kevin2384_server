import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeProvider } from './providers/stripe.provider';
import { PayoutScheduler } from './scheduler/payouts.scheduler';

@Module({
    providers:[PrismaService, PaymentService, StripeProvider, PayoutScheduler],
    controllers:[PaymentController],
    exports:[PaymentService, StripeProvider]
    
})
export class PaymentModule {}
