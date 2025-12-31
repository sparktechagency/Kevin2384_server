import { Inject, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { SessionStatus } from "generated/prisma/enums";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { RefundAutoAcceptedStrategy } from "../strategies/RefundAutoAccepted.strategy";
import type { RefundStrategy } from "../strategies/RefundStrategy.interface";
import { AdminApprovalStrategy } from "../strategies/AdminApprovalRefundRequest.strategy";
import { Session } from "generated/prisma/client";

@Injectable()
export class RefundRequestResolver {

    constructor(

        @Inject(RefundAutoAcceptedStrategy.INJECTION_KEY)
        private readonly refundAutoAccepted:RefundStrategy,

        @Inject(AdminApprovalStrategy.INJECTION_KEY)
        private readonly adminApprovalRefundRequest:RefundStrategy
    ){}

    async resolveRefundRequest(participantId:string, session:Session, reason:string){
        try{

            if(session.status === SessionStatus.CANCELLED || session.status === SessionStatus.CREATED){
            await this.refundAutoAccepted.handleRefundRequest(participantId, session, reason)
        }

            if(session.status === SessionStatus.ONGOING){
                await this.adminApprovalRefundRequest.handleRefundRequest(participantId, session, reason)
            }
        }catch(err){

            console.log(err)

            throw new InternalServerErrorException("Refund Processing failed!")
        }

    }

}