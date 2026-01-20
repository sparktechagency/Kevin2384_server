import { Injectable } from "@nestjs/common";
import { RefundStrategy } from "./RefundStrategy.interface";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { Audience, NotificationLevel, PaymentStatus, RefundRequestStatus, RefundRequestType } from "generated/prisma/enums";
import { Session } from "generated/prisma/client";
import { NotificationService } from "src/modules/notification/notification.service";

@Injectable()
export class AdminApprovalStrategy implements RefundStrategy {
    public static readonly INJECTION_KEY = "Admin_Approval_Strategy"

    constructor(
        private readonly prismaService: PrismaService,
        private readonly notificationService: NotificationService
    ) { }

    async handleRefundRequest(participantId: string, session: Session, reason: string) {
        const payment = await this.prismaService.payment.findFirst({
            where: { item_id: session.id, buyer_id: participantId, status: PaymentStatus.Succeeded }
        });

        if (!payment) {
            throw new Error("Payment not found for this session");
        }

        // Create a refund request for admin approval
        const refundRequest = await this.prismaService.refundRequest.create({
            data: {
                participant_id: participantId,
                session_id: session.id,
                status: RefundRequestStatus.Pending,
                payment_id: payment.id,
                refund_request_type: RefundRequestType.AdminApproval,
                refunded_amount: payment.session_fee,
                reason
            }
        });

        // Send notification outside transaction
        try {
            const participant = await this.prismaService.sessionParticipant.findUnique({
                where: { id: participantId }
            });

            if (participant) {
                await this.notificationService.createNotification({
                    userId: participant.player_id,
                    audience: Audience.USER,
                    level: NotificationLevel.INFO,
                    title: "Refund Request Submitted for Admin Approval",
                    message: `Your refund request for session "${session.title}" has been submitted for admin approval. Admin will contact you shortly.`
                });
            }
        } catch (err) {
            console.log("Failed to send refund notification:", err);
        }

        return refundRequest;
    }

}