import { Injectable } from "@nestjs/common";
import { SessionCancelStrategy } from "./SessionCancelStrategy.interface";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { RefundRequestResolver } from "src/modules/refund/providers/RefundRequestResolver.provider";
import { Audience, NotificationLevel, PlayerStatus, SessionStatus } from "generated/prisma/enums";
import { Session, SessionParticipant } from "generated/prisma/client";
import { NotificationService } from "src/modules/notification/notification.service";

@Injectable()
export class AdminCancelStrategy implements SessionCancelStrategy {
    public static readonly INJECTION_KEY = "Admin_Cancel_Strategy"

    constructor(
        private readonly prismaService:PrismaService,
        private readonly refundRequestResolver:RefundRequestResolver,
        private readonly notificationService:NotificationService

    ){}

    async handleCancelRequest(userId: string, session: Session, participants:SessionParticipant[], reason:string): Promise<void> {

        await this.prismaService.$transaction(async prisma => {
            //If session cancelled by coach, session wi;; be cancelled and process refunds for all the participants
            await prisma.session.update({where:{id:session.id}, data:{status:SessionStatus.CANCELLED}})

        // const sessionCancelRequest = await this.prismaService.sessionCancelRequest.create({
        //     data:{coach_id:userId,
        //         session_id:cancelSessionDto.sessionId,
        //         reason:cancelSessionDto.note, sataus:SessionCancelRequestStatus.Accepted}
        // })

            if(session.fee <= 0){
                for(const participant of participants){
                    await this.prismaService.sessionParticipant.update({where:{id:participant.id}, data:{player_status:PlayerStatus.Cancelled}})
                    this.notificationService.createNotification({
                        userId:participant.player_id,
                        audience:Audience.USER,
                        level:NotificationLevel.INFO,
                        title:"Session Cancelled By Admin",
                        message:`Reason: ${{reason}}`
                    })
                }
            }else {
                
                for (const participant of participants){

                    await this.prismaService.sessionParticipant.update({where:{id:participant.id}, data:{player_status:PlayerStatus.Cancelled}})
                    this.notificationService.createNotification({
                        userId:participant.player_id,
                        audience:Audience.USER,
                        level:NotificationLevel.INFO,
                        title:"Session Cancelled By Admin",
                        message:`Reason: ${{reason}}`
                    })

                    if(participant.payment_method === "ONLINE" && participant.payment_status === "Paid")
                        await this.refundRequestResolver.resolveRefundRequest(participant.id, session, reason)
                }
                

            }
   
        })
        
        

     }

}