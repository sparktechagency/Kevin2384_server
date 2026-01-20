import { Injectable } from "@nestjs/common";
import { SessionCancelStrategy } from "./SessionCancelStrategy.interface";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { RefundRequestResolver } from "src/modules/refund/providers/RefundRequestResolver.provider";
import { Audience, NotificationLevel, ParticipantPaymentStatus, PaymentMethod, PlayerStatus, SessionStatus } from "generated/prisma/enums";
import { Session, SessionParticipant } from "generated/prisma/client";
import { NotificationService } from "src/modules/notification/notification.service";

@Injectable()
export class AdminCancelStrategy implements SessionCancelStrategy {
    public static readonly INJECTION_KEY = "Admin_Cancel_Strategy"

    constructor(
        private readonly prismaService: PrismaService,
        private readonly refundRequestResolver: RefundRequestResolver,
        private readonly notificationService: NotificationService
    ) { }

    async handleCancelRequest(userId: string, session: Session, participants: SessionParticipant[], reason: string): Promise<void> {
        await this.prismaService.$transaction(async prisma => {
            // If session cancelled by admin, session will be cancelled and process refunds for all the participants
            await prisma.session.update({ where: { id: session.id }, data: { status: SessionStatus.CANCELLED } });

            if (session.fee <= 0) {
                // Free session - just cancel participants
                for (const participant of participants) {
                    await prisma.sessionParticipant.update({
                        where: { id: participant.id },
                        data: { player_status: PlayerStatus.Cancelled }
                    });
                }
            } else {
                // Paid session - cancel participants and process refunds
                for (const participant of participants) {
                    await prisma.sessionParticipant.update({
                        where: { id: participant.id },
                        data: { player_status: PlayerStatus.Cancelled }
                    });

                    if (participant.payment_method === PaymentMethod.ONLINE && participant.payment_status === ParticipantPaymentStatus.Paid) {
                        await this.refundRequestResolver.resolveRefundRequest(participant.id, session, reason);
                    }
                }
            }
        });

        // Send notifications outside transaction
        for (const participant of participants) {
            try {
                await this.notificationService.createNotification({
                    userId: participant.player_id,
                    audience: Audience.USER,
                    level: NotificationLevel.INFO,
                    title: "Session Cancelled By Admin",
                    message: `Reason: ${reason}`
                });
            } catch (err) {
                console.log("Failed to send notification to player:", participant.player_id, err);
            }
        }
    }

}