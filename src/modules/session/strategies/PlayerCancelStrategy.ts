import { Injectable } from "@nestjs/common";
import { SessionCancelStrategy } from "./SessionCancelStrategy.interface";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { RefundRequestResolver } from "src/modules/refund/providers/RefundRequestResolver.provider";
import { Audience, NotificationLevel, PlayerStatus, Session, SessionParticipant, SessionStatus } from "generated/prisma/client";
import { NotificationService } from "src/modules/notification/notification.service";

@Injectable()
export class PlayerCancelStrategy implements SessionCancelStrategy {
    public static readonly INJECTION_KEY = "Player_Cancel_Strategy"

    constructor(
        private readonly refundRequestResolver:RefundRequestResolver,
        private readonly prismaService:PrismaService,
        private readonly notificationService:NotificationService

){}

    async handleCancelRequest(userId: string, session: Session, participant:SessionParticipant, reason:string): Promise<void> {

        await this.prismaService.$transaction(async prisma => {

            if(session.fee <= 0){
             await this.prismaService.sessionParticipant.update({where:{id:participant.id}, data:{player_status:PlayerStatus.Cancelled}})

             this.notificationService.createNotification({
                userId:participant.player_id,
                audience:Audience.USER,
                level:NotificationLevel.INFO,
                title:"Session Cancelled",
                message:`You cancelled the session named ${session.title}`
             })

        }else{

            if(session.status === SessionStatus.CREATED){
                await this.prismaService.sessionParticipant.update({where:{id:participant.id}, data:{player_status:PlayerStatus.Cancelled}})
                this.notificationService.createNotification({
                        userId:participant.player_id,
                        audience:Audience.USER,
                        level:NotificationLevel.INFO,
                        title:"Session Cancelled",
                        message:`You cancelled the session named ${session.title}`
                    })
            }
            
            if(participant.payment_method === 'ONLINE' && participant.payment_status === "Paid"){
                await this.refundRequestResolver.resolveRefundRequest(participant.id, session, reason)
            }
            
        }

        })

       
        

        
    }
}