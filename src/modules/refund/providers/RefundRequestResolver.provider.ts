import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { SessionStatus } from "generated/prisma/enums";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { RefundAutoAcceptedStrategy } from "../strategies/RefundAutoAccepted.strategy";
import type { RefundStrategy } from "../strategies/RefundStrategy.interface";
import { AdminApprovalStrategy } from "../strategies/AdminApprovalRefundRequest.strategy";
import { Session } from "generated/prisma/client";

@Injectable()
export class RefundRequestResolver {

    constructor(
        private readonly prismaService:PrismaService,

        @Inject(RefundAutoAcceptedStrategy.INJECTION_KEY)
        private readonly refundAutoAccepted:RefundStrategy,

        @Inject(AdminApprovalStrategy.INJECTION_KEY)
        private readonly adminApprovalRefundRequest:RefundStrategy
    ){}

    async resolveRefundRequest(participantId:string, session:Session){


        if(session.status === SessionStatus.CANCELLED || session.status === SessionStatus.CREATED){
            await this.refundAutoAccepted.handleRefundRequest(participantId, session)
        }

        if(session.status === SessionStatus.ONGOING || session.status === SessionStatus.COMPLETED){
            await this.adminApprovalRefundRequest.handleRefundRequest(participantId, session)
        }

    }

}