import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Session } from "generated/prisma/client";
import { Audience, NotificationLevel, ParticipantPaymentStatus, PayoutStatus, PlayerStatus, RefundRequestStatus, SessionStatus } from "generated/prisma/enums";
import { NotificationService } from "src/modules/notification/notification.service";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { StripeProvider } from "../providers/stripe.provider";

@Injectable()
export class PayoutScheduler {

    private readonly logger = new Logger(PayoutScheduler.name)

    constructor(private readonly prismaService:PrismaService, private readonly notificationService:NotificationService,
        private readonly stripeProvider:StripeProvider
    ){}

    @Cron(CronExpression.EVERY_10_SECONDS)
    async payoutsWatcher(){
        this.logger.log("payout scheduler running...")
         const sessions = await this.prismaService.session.findMany({where:{status:SessionStatus.COMPLETED}, include:{coach:true}})
         sessions.forEach(async session => {
            
            await this.createPayout(session)
         })

        this.logger.log("payout scheduler exiting...")

    }

    async createPayout(session:Session){

        //check does payout already created
        const payout = await this.prismaService.duePayouts.findFirst({where:{
            session_id:session.id
        }})

        //if payout does not created yet, check the session to create payout
        if(!payout){

            //does the session has any pending refund reequest
            //if yes ignore that session
            const refundRequest = await this.prismaService.refundRequest.findMany({
                where:{session_id:session.id, status:RefundRequestStatus.Pending}})
            
            //if no pending session in the db
            //calculate the payout amount 
            if(refundRequest.length <= 0){

                const paidParticipant = await this.prismaService.sessionParticipant.findMany({
                    where:{session_id:session.id, player_status:PlayerStatus.Attending, payment_status:ParticipantPaymentStatus.Paid}
                })

                const session_fee = session.fee
                const totalparticipatedPlayer = paidParticipant.length
                
                const totalPayableAmount = session_fee * totalparticipatedPlayer

                const payout = await this.prismaService.duePayouts.create({data:{
                    total_amount:totalPayableAmount,
                    coach_id:session.coach_id,
                    session_id:session.id,
                }})

                // this.stripeProvider.transfer(payout.total_amount, )

                this.notificationService.createNotification({
                    audience:Audience.USER,
                    level:NotificationLevel.INFO,
                    title:"Payout created",
                    message:`Payout created for session ${session.title}`,
                    userId:session.coach_id
                })

            }
        }
        
    }


    async calculateRefundAmount(sessionId:string){
        const refundRequest = await this.prismaService.refundRequest.findMany({where:{session_id:sessionId, status:RefundRequestStatus.Accepted}})
        return refundRequest
    }

    async releasePayout(){

    }

}