import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { RefundRequestStatus } from "generated/prisma/enums";

@Injectable()
export class RefundService {

    constructor(private readonly prismaServce:PrismaService){}

    
    async getCoachRefundData(coachId:string, paginationDto:PaginationDto){

        const skip = (paginationDto.page - 1 ) * paginationDto.limit

        const refundData = await this.prismaServce.$transaction(async prisma => {

            const refunds = await prisma.refundRequest.findMany({
                where:{session:{coach_id:coachId}},
                include:{session:{select:{title:true}}, participant:{select:{player:{select:{fullName:true}}}}},
                skip,
                take:paginationDto.limit,
            })

            const total = await prisma.refundRequest.count({
                where:{session:{coach_id:coachId}, status:RefundRequestStatus.Accepted}
            })

            const mappeddrefundRequest = refunds.map(refund => {

                return {...refund, player_name:refund.participant.player.fullName, session_title:refund.session.title}
            })

            return {refunds:mappeddrefundRequest, total}
        })

        return refundData
    }


}