import { Injectable } from "@nestjs/common";
import { SessionCancelStrategy } from "./SessionCancelStrategy.interface";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { RefundRequestResolver } from "src/modules/refund/providers/RefundRequestResolver.provider";
import { Audience, NotificationLevel, ParticipantPaymentStatus, PaymentMethod, PlayerStatus, Session, SessionParticipant, SessionStatus } from "generated/prisma/client";
import { NotificationService } from "src/modules/notification/notification.service";

@Injectable()
export class PlayerCancelStrategy implements SessionCancelStrategy {
    public static readonly INJECTION_KEY = "Player_Cancel_Strategy"

    constructor(
        private readonly refundRequestResolver: RefundRequestResolver,
        private readonly prismaService: PrismaService,
        private readonly notificationService: NotificationService
    ) { }

    async handleCancelRequest(userId: string, session: Session, participant: SessionParticipant, reason: string): Promise<void> {
        await this.prismaService.$transaction(async prisma => {
            if (session.fee <= 0) {
                // Free session - just cancel participant
                await prisma.sessionParticipant.update({
                    where: { id: participant.id },
                    data: { player_status: PlayerStatus.Cancelled }
                });
            } else {
                // Paid session - cancel participant and process refund if needed
                if (session.status === SessionStatus.CREATED) {
                    await prisma.sessionParticipant.update({
                        where: { id: participant.id },
                        data: { player_status: PlayerStatus.Cancelled }
                    });
                }

                if (participant.payment_method === PaymentMethod.ONLINE && participant.payment_status === ParticipantPaymentStatus.Paid) {
                    await this.refundRequestResolver.resolveRefundRequest(participant.id, session, reason);
                }
            }
        });

        // Send notification outside transaction
        try {
            await this.notificationService.createNotification({
                userId: participant.player_id,
                audience: Audience.USER,
                level: NotificationLevel.INFO,
                title: "Session Cancelled",
                message: `You cancelled the session named ${session.title}`
            });
        } catch (err) {
            console.log("Failed to send notification to player:", participant.player_id, err);
        }
    }
}