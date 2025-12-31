import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Session } from "generated/prisma/client";
import { ParticipantPaymentStatus, PaymentStatus, RecurringStatus, SessionStatus } from "generated/prisma/enums";
import { RRule } from "rrule";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { SESSION_CONSTANTS } from "../constants";

@Injectable()
export class SessionScheduler{
    private readonly logger = new Logger(SessionScheduler.name)

    constructor(private readonly prismaService:PrismaService){}

    @Cron(CronExpression.EVERY_10_SECONDS)
    async markSessioAsCompleted(){
        this.logger.log("session scheduler running...")
       const sessions = await this.prismaService.session.findMany({where:{status:SessionStatus.ONGOING}})

     
        sessions.forEach(async session => {
            if(session.completed_at <= new Date(Date.now())){
                await this.prismaService.session.update({where:{id:session.id}, data:{status:SessionStatus.COMPLETED, report_valid:false}})
                console.log(`session completed: `, session.id)
            }
        })
    
       
       this.logger.log("session scheduler exiting...")   
    }

    @Cron(CronExpression.EVERY_10_SECONDS)
    async markSessionAsOngoing(){
        this.logger.log("session ongoing scheduler running...")
        const currentDate = new Date(Date.now())
        await this.prismaService.session.updateMany({where:{started_at:{lte:currentDate}, status:SessionStatus.CREATED}, 
            data:{status:SessionStatus.ONGOING, report_till:new Date(Date.now() + 24 * 60 * 60 * 1000), report_valid:true}})
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


    // async scheduleRecurringSession(){
    //     const recurringSessions = await this.prismaService.recurringData.findMany({include:{template:true}})

    //     recurringSessions.forEach(async recurringSession => {

    //         if(recurringSession.next_published && (recurringSession.status === RecurringStatus.ACTIVE)){
                
    //             const next7Days = new Date(new Date(Date.now() + SESSION_CONSTANTS.SESSION_CREATE_BEFORE_DAYS))

    //             const dates  = RRule.fromString(recurringSession.recurrence_rule).between(new Date(Date.now()), next7Days, true, (d, len) => {
    //                 return d > recurringSession.next_published! 
    //             })
                
    //             dates.forEach(async date => {
    //                 const template = recurringSession.template
    //                 template.started_at = date
    //                 template.completed_at = new Date(date.getTime() + SESSION_CONSTANTS.SESSION_COMPLETE_AFTER_DAYS)
    //                 const location = JSON.parse(template.location as string)

    //                 await this.prismaService.session.create({data:{...template, location}})
    //             })

    //             await this.prismaService.recurringData.update({where:{id:recurringSession.id}, data:{
    //                 latest_published:new Date(Date.now()),
    //                 next_published: next7Days <= recurringSession.ended_at ? next7Days:null
    //             }})

    //         }
    //     })
    // }

}