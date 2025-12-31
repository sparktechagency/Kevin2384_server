import { PaymentStatus, RefundRequestStatus, ReportStatus, UserRole } from "generated/prisma/enums";
import { PrismaService } from "../prisma/prisma.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PaginationDto } from "src/common/dtos/pagination.dto";

@Injectable()
export class DashboardService{


    constructor(private readonly prismaService:PrismaService){}


    async getOverview(){

        const totalPlayers = await this.prismaService.user.count({where:{role:UserRole.PLAYER}})
        const totalCaoches = await this.prismaService.user.count({where:{role:UserRole.COACH}})

        const totalSessions = await this.prismaService.session.count({where:{}})

        const payments = await this.prismaService.payment.findMany({where:{status:PaymentStatus.Succeeded}})

        const totalEarnings = payments.reduce((pre, curr) => curr.total_amount + pre, 0)
        const refunds = await this.prismaService.refundRequest.findMany({where:{status:RefundRequestStatus.Paid}})

        const totalRefunds = refunds.reduce((pre, curr) => curr.refunded_amount+pre, 0)

        return {totalPlayers, totalCaoches, totalSessions, totalEarnings, totalRefunds}

    }

    async setPlatFormFee(userId:string, fee:number){

        const platFormFee = await this.prismaService.platformFee.findFirst()

        if(platFormFee){
            return await this.prismaService.platformFee.update({where:{id:platFormFee.id}, data:{fee}})
        }

        return await this.prismaService.platformFee.create({data:{fee}})
    }

    
    async getPlatFormFee(userId:string){

        const platFormFee = await this.prismaService.platformFee.findFirst()
       
        return platFormFee
    }

    async getReports(userId:string, pagination:PaginationDto){

        const skip = (pagination.page - 1 ) * pagination.limit

        const reports = await this.prismaService.report.findMany({
            where:{need_refund:false},
            include:{participant:{select:{player:{select:{id:true, avatar:true, fullName:true}}, id:true}}},
            skip,
            take:pagination.limit,
            orderBy:{createdAt:"desc"}
        })


        const total = await this.prismaService.report.count({where:{need_refund:false}})


        return {reports, total}
    }

    async replyToReport(userId:string,reportId:string, reply:string){

        const report = await this.prismaService.report.findUnique({where:{id:reportId, status:ReportStatus.Pending}})

        if(!report){
            throw new NotFoundException("report not found")
        }

        const updatedReport = await this.prismaService.report.update({

            where:{id:report.id},
            data:{replied_by:userId, reply, status:ReportStatus.Replied}
        })

        return updatedReport
    }


}