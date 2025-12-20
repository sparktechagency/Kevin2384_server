import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PayoutStatus, RefundRequestStatus, SessionStatus } from "generated/prisma/enums";
import { PrismaService } from "src/modules/prisma/prisma.service";

@Injectable()
export class PayoutScheduler {

    private readonly logger = new Logger(PayoutScheduler.name)

    constructor(private readonly prismaService:PrismaService){}

    @Cron(CronExpression.EVERY_10_SECONDS)
    async payoutsWatcher(){
        this.logger.log("payout scheduler running...")
        const payouts  = await this.prismaService.duePayouts.findMany({where:{status:PayoutStatus.Pending}})

        payouts.forEach(async payout => {
            const refundRequests = await this.prismaService.refundRequest.findMany({where:{session_id:payout.session_id, status:RefundRequestStatus.Pending}, include:{payment:true}})
            const totalHoldAmount = refundRequests.reduce((pre, refund) => pre+refund.payment.total_amount, 0)
            const actualAmount = payout.total_amount - totalHoldAmount

            if(refundRequests.length >= 0)
                await this.prismaService.duePayouts.update({where:{id:payout.id}, data:{status:PayoutStatus.Hold}})
            else 
                console.log("release money")

        })

        this.logger.log("payout scheduler exiting...")

    }

    async createPayout(){

        const sessions = await this.prismaService.session.findMany({where:{status:SessionStatus.COMPLETED}})

        sessions.forEach(async session => {

            const payout = await this.prismaService.duePayouts.findFirst({where:{
                session_id:session.id
            }})
            if(!payout){
                const refundRequest = await this.prismaService.refundRequest.findMany({where:{session_id:session.id, status:RefundRequestStatus.Pending}})
                if(refundRequest.length <= 0){
                    const acceptedRefundRequest = await this.prismaService.refundRequest.findMany({
                        where:{session_id:session.id, status:RefundRequestStatus.Accepted}
                    })
                }
            }
        })
        
    }


    async calculateRefundAmount(sessionId:string){
        const refundRequest = await this.prismaService.refundRequest.findMany({where:{session_id:sessionId, status:RefundRequestStatus.Accepted}})
        return refundRequest
    }

}