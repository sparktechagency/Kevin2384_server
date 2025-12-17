import { Module } from '@nestjs/common';
import { RefundRequestResolver } from './providers/RefundRequestResolver.provider';
import { RefundAutoAcceptedStrategy } from './strategies/RefundAutoAccepted.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { AdminApprovalStrategy } from './strategies/AdminApprovalRefundRequest.strategy';
import { RefundController } from './refund.controller';
import { RefundService } from './refund.service';

@Module({
    providers:[
        PrismaService,
        {
            provide: RefundAutoAcceptedStrategy.INJECTION_KEY,
            useClass: RefundAutoAcceptedStrategy
        },
        {
            provide: AdminApprovalStrategy.INJECTION_KEY,
            useClass: AdminApprovalStrategy
        },
        RefundRequestResolver,
        RefundService
    ],
    controllers:[RefundController],
    exports:[RefundRequestResolver]
})
export class RefundModule {}
