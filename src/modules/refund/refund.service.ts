import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { Audience, NotificationLevel, ParticipantPaymentStatus, PlayerStatus, RefundRequestStatus, RefundRequestType } from "generated/prisma/enums";
import { NotificationService } from "../notification/notification.service";

@Injectable()
export class RefundService {

    constructor(private readonly prismaServce:PrismaService,
        private readonly notificationService:NotificationService
    ){}

    
    async getCoachRefundData(coachId:string, paginationDto:PaginationDto){

        const skip = (paginationDto.page - 1 ) * paginationDto.limit

        const refundData = await this.prismaServce.$transaction(async prisma => {

            const refunds = await prisma.refundRequest.findMany({
                where:{session:{coach_id:coachId}, refund_request_type:RefundRequestType.AdminApproval},
                include:{session:{select:{title:true}}, participant:{select:{player:{select:{fullName:true, avatar:true}}}}},
                skip,
                take:paginationDto.limit,
            })

            const total = await prisma.refundRequest.count({
                where:{session:{coach_id:coachId},refund_request_type:RefundRequestType.AdminApproval}
            })

            const mappeddrefundRequest = refunds.map(refund => {

                return {...refund, player_name: refund.participant.player.fullName, avatar:refund.participant.player.avatar, session_title:refund.session.title}
            })

            return {refunds:mappeddrefundRequest, total}
        })

        return refundData
    }

    async acceptRefundRequest(adminId:string, requestId:string){

        const request = await this.prismaServce.refundRequest.findUnique({
            where:{id:requestId, status:RefundRequestStatus.Pending},
            include:{participant:true}
        })

        if(!request){
            throw new NotFoundException("request not found")
        }

        const acceptedRefundRequest = await this.prismaServce.refundRequest.update({where:{id:request.id}, data:{status:RefundRequestStatus.Accepted,accepted_by:adminId}})

        if(acceptedRefundRequest.refund_request_type === RefundRequestType.AdminApproval){

            await this.prismaServce.sessionParticipant.update({where:{id:acceptedRefundRequest.participant_id}, data:{player_status:PlayerStatus.Cancelled, payment_status:ParticipantPaymentStatus.Refunded}})

        }

        await this.notificationService.createNotification({
            userId:request.participant.player_id,
            title:"Refund request accepetd",
            message:`Your refund request has been accepted`,
            audience:Audience.USER,
            level:NotificationLevel.INFO
        })

        return acceptedRefundRequest

    }

    async rejectRefundRequest(adminId:string, requestId:string, note?:string){

        const request = await this.prismaServce.refundRequest.findUnique({
            where:{id:requestId, status:RefundRequestStatus.Pending},
            include:{participant:true}
        })

        if(!request){
            throw new NotFoundException("request not found")
        }

        const rejectedRefundRequest = await this.prismaServce.refundRequest.update({where:{id:request.id}, data:{status:RefundRequestStatus.Cancelled, rejection_note:note}})

        await this.notificationService.createNotification({
            userId:request.participant.player_id,
            title:"Refund request rejected",
            message:`Your refund request has been rejected`,
            audience:Audience.USER,
            level:NotificationLevel.INFO,
        })

        return rejectedRefundRequest

    }


}