import { Injectable } from "@nestjs/common";
import { SessionCancelStrategy } from "./SessionCancelStrategy.interface";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { RefundRequestResolver } from "src/modules/refund/providers/RefundRequestResolver.provider";
import { SessionStatus } from "generated/prisma/enums";
import { Session, SessionParticipant } from "generated/prisma/client";

@Injectable()
export class CoachCancelStrategy implements SessionCancelStrategy {
    public static readonly INJECTION_KEY = "Coach_Cancel_Strategy"

    constructor(
        private readonly prismaService:PrismaService,
        private readonly refundRequestResolver:RefundRequestResolver

    ){}

    async handleCancelRequest(userId: string, session: Session, participants:SessionParticipant[]): Promise<void> {
        
        
        await this.prismaService.session.update({where:{id:session.id}, data:{status:SessionStatus.CANCELLED}})

        // const sessionCancelRequest = await this.prismaService.sessionCancelRequest.create({
        //     data:{coach_id:userId,
        //         session_id:cancelSessionDto.sessionId,
        //         reason:cancelSessionDto.note, sataus:SessionCancelRequestStatus.Accepted}
        // })
   
        for (const participant of participants){

            if(participant.payment_method === "ONLINE" && participant.payment_status === "Paid")
                await this.refundRequestResolver.resolveRefundRequest(participant.id, session)
        }

     }

}