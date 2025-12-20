import { BadRequestException, Injectable } from "@nestjs/common";
import { RefundStrategy } from "./RefundStrategy.interface";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { ParticipantPaymentStatus, PaymentStatus, PaymentType, PlayerStatus, RefundRequestStatus, RefundRequestType } from "generated/prisma/enums";
import { Session } from "generated/prisma/client";

@Injectable()
export class RefundAutoAcceptedStrategy implements RefundStrategy{
    public static readonly INJECTION_KEY = "Refund_Auto_Accepted_Strategy"

    constructor(private readonly prismaService:PrismaService){}

    async handleRefundRequest(participantId:string, session:Session, reason:string) {
        const existingRefundRequest = await this.prismaService.refundRequest.findFirst({where:{participant_id:participantId, session_id:session.id}})

        if(existingRefundRequest){
            throw new BadRequestException("refund request already submitted")
        }
        const refundRequest = await this.prismaService.$transaction(async prisma => {

            const payment = await this.prismaService.payment.findFirst({where:{item_id:session.id, buyer_id:participantId, status:PaymentStatus.Succeeded}})
            if(!payment){
                throw new Error("Payment does not find")
            }

            const refundRequest = await prisma.refundRequest.create({data:{
                participant_id:participantId,
                session_id:session.id,
                status:RefundRequestStatus.Accepted,
                refunded_amount:payment.total_amount,
                payment_id:payment.id,
                refund_request_type:RefundRequestType.AutoAccepted,
                reason
            }})

            await prisma.payment.create({data:{
                payment_type:PaymentType.Refund,
                buyer_id:participantId,
                total_amount:payment.total_amount,
                platform_fee:payment.platform_fee,
                session_fee:payment.session_fee,
                item_id:session.id
            }})

            await prisma.sessionParticipant.update({
                where:{id:participantId, session_id:session.id}, data:{player_status:PlayerStatus.Cancelled}})

            return  refundRequest
        })
      
        return refundRequest
        

    }

}