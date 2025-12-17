import { RefundRequest, Session } from "generated/prisma/client";

export interface RefundStrategy {

    handleRefundRequest(participantId:string, session:Session, reason:string):Promise<RefundRequest>
}