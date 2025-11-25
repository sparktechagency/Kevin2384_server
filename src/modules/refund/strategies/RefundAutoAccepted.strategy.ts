import { BadRequestException, Injectable } from "@nestjs/common";
import { RefundStrategy } from "./RefundStrategy.interface";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { RefundRequestStatus } from "generated/prisma/enums";
import { Session } from "generated/prisma/client";

@Injectable()
export class RefundAutoAcceptedStrategy implements RefundStrategy{
    public static readonly INJECTION_KEY = "Refund_Auto_Accepted_Strategy"

    constructor(private readonly prismaService:PrismaService){}

    async handleRefundRequest(participantId:string, session:Session) {
        const existingRefundRequest = await this.prismaService.refundRequest.findFirst({where:{participant_id:participantId, session_id:session.id}})

        if(existingRefundRequest){
            throw new BadRequestException("refund request already submitted")
        }
        const refundRequest = await this.prismaService.$transaction(async $trns => {

            const refundRequest = await $trns.refundRequest.create({data:{
                participant_id:participantId,
                session_id:session.id,
                status:RefundRequestStatus.Accepted
            }})

            await $trns.sessionParticipant.update({where:{id:participantId}, data:{player_status:"Cancelled"}})

            return  refundRequest
        })
      
        return refundRequest
        

    }

}