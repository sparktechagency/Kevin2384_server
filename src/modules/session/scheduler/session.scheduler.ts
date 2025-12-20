import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Session } from "generated/prisma/client";
import { ParticipantPaymentStatus, PaymentStatus, SessionStatus } from "generated/prisma/enums";
import { PrismaService } from "src/modules/prisma/prisma.service";

@Injectable()
export class SessionScheduler{
    private readonly logger = new Logger(SessionScheduler.name)

    constructor(private readonly prismaService:PrismaService){}

    @Cron(CronExpression.EVERY_10_SECONDS)
    async markSessioAsCompleted(){
        this.logger.log("session scheduler running...")
       const sessions = await this.prismaService.session.findMany({where:{status:SessionStatus.ONGOING}})

       await this.prismaService.$transaction(async prisma => {
            sessions.forEach(async session => {
                if(session.completed_at <= new Date(Date.now())){
                    await prisma.session.update({where:{id:session.id}, data:{status:SessionStatus.COMPLETED}})
                    console.log(`session completed: `, session.id)
                }
            })
       })
       
       this.logger.log("session scheduler exiting...")   
    }

    @Cron(CronExpression.EVERY_10_SECONDS)
    async markSessionAsOngoing(){
        this.logger.log("session ongoing scheduler running...")
        const currentDate = new Date(Date.now())
        await this.prismaService.session.updateMany({where:{started_at:{lte:currentDate}, status:SessionStatus.CREATED}, data:{status:SessionStatus.ONGOING}})
        this.logger.log("session ongoing scheduler exiting...")
    }

    async createPayout(session:Session){

        const totalPayments = await this.prismaService.payment.findMany({where:{ item_id:session.id,  status:PaymentStatus.Succeeded,refund:null}})
        const totalAmount = totalPayments.reduce( (prev, payment) => prev + payment.total_amount, 0)
        const refundRequests = await this.prismaService.refundRequest.findMany({where:{session_id:session.id}, include:{payment:true}})
        // const totalHoldAmount = refundRequests.reduce((pre, refund) => pre+refund.payment.amount, 0)
        // const actualAmount = payout.total_amount - totalHoldAmount
        if(refundRequests.length > 0){

        }

        
        await this.prismaService.duePayouts.create({data:{
            coach_id:session.coach_id,
            session_id:session.id,
            total_amount:totalAmount
        }})
    }

}