import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { Audience, NotificationLevel, ParticipantPaymentStatus, PlayerStatus, RefundRequestStatus, RefundRequestType } from "generated/prisma/enums";
import { NotificationService } from "../notification/notification.service";
import { PaymentService } from "../payment/payment.service";
import { StripeProvider } from "../payment/providers/stripe.provider";

@Injectable()
export class RefundService {

    constructor(private readonly prismaServce:PrismaService,
        private readonly notificationService:NotificationService,
        private readonly stripeProvider:StripeProvider
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
            where:{id:requestId, status:RefundRequestStatus.Pending, refund_request_type:RefundRequestType.AdminApproval},
            include:{participant:true}
        })

        if(!request){
            throw new NotFoundException("request not found")
        }

        const acceptedRefudnRequest = await this.prismaServce.$transaction(async prisma => {

            const acceptedRefundRequest = await prisma.refundRequest.update({where:{id:request.id}, data:{status:RefundRequestStatus.Accepted,accepted_by:adminId}})
            this.stripeProvider.refund(request.refunded_amount, request.payment_id, request.session_id, request.participant_id)

            await this.notificationService.createNotification({
                userId:request.participant.player_id,
                title:"Refund request accepetd",
                message:`Your refund request has been accepted`,
                audience:Audience.USER,
                level:NotificationLevel.INFO
            })

            return acceptedRefundRequest
        })

    
        return acceptedRefudnRequest

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

    async getRefundStatus(userId:string, sessionId:string){
        const refund = await this.prismaServce.refundRequest.findFirst({
            where:{session_id:sessionId, participant:{player_id:userId}}})

        if(!refund){
            throw new NotFoundException("refund not found")
        }

        return refund
    
    }

    async getRefundRequests(pagination:PaginationDto){
        const skip = (pagination.page - 1) * pagination.limit

        const refunds = await this.prismaServce.refundRequest.findMany({
            where:{refund_request_type:RefundRequestType.AdminApproval},
            include:{participant:{include:{player:true}}, session:{include:{coach:true }}},
            skip,
            take:pagination.limit,
            orderBy:{createdAt:"desc"}
        })


        const count = await this.prismaServce.refundRequest.count({
            where:{refund_request_type:RefundRequestType.AdminApproval}
        })

        const mappedRefunds = refunds.map(refund => {

            return {...refund, 
                player_name:refund.participant.player.fullName, 
                avatar:refund.participant.player.avatar,
                session_title:refund.session.title,
                coach:refund.session.coach

            }
        })

        return {refunds:mappedRefunds, total:count}
    }


}