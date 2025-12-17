import { Injectable } from "@nestjs/common";
import { SessionCancelStrategy } from "./SessionCancelStrategy.interface";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { RefundRequestResolver } from "src/modules/refund/providers/RefundRequestResolver.provider";
import { Session, SessionParticipant } from "generated/prisma/client";

@Injectable()
export class PlayerCancelStrategy implements SessionCancelStrategy {
    public static readonly INJECTION_KEY = "Player_Cancel_Strategy"

    constructor(
        private readonly refundRequestResolver:RefundRequestResolver
){}

    async handleCancelRequest(userId: string, session: Session, participant:SessionParticipant, reason:string): Promise<void> {
        

        if(participant.payment_method === 'ONLINE' && participant.payment_status === "Paid"){
            await this.refundRequestResolver.resolveRefundRequest(participant.id, session, reason)
        }
            
        
    }
}