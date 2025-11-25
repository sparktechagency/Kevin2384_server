import { Injectable } from "@nestjs/common";
import { RefundStrategy } from "./RefundStrategy.interface";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { RefundRequestStatus } from "generated/prisma/enums";
import { Session } from "generated/prisma/client";

@Injectable()
export class AdminApprovalStrategy implements RefundStrategy{
    public static readonly INJECTION_KEY = "Admin_Approval_Strategy"

    constructor(private readonly prismaService:PrismaService){}

    async handleRefundRequest(participantId:string, session:Session) {
        
        const refundRequest = await this.prismaService.refundRequest.create({data:{
                    participant_id:participantId,
                    session_id:session.id,
                    status:RefundRequestStatus.Pending
                }})

        return refundRequest
    }

}