import { BadRequestException, Injectable } from "@nestjs/common";
import { RefundStrategy } from "./RefundStrategy.interface";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { Audience, NotificationLevel, ParticipantPaymentStatus, PaymentStatus, PaymentType, PlayerStatus, RefundRequestStatus, RefundRequestType } from "generated/prisma/enums";
import { Session } from "generated/prisma/client";
import { NotificationService } from "src/modules/notification/notification.service";
import { StripeProvider } from "src/modules/payment/providers/stripe.provider";

@Injectable()
export class RefundAutoAcceptedStrategy implements RefundStrategy {
    public static readonly INJECTION_KEY = "Refund_Auto_Accepted_Strategy"

    constructor(
        private readonly prismaService: PrismaService,
        private readonly notificationService: NotificationService,
        private readonly stripeProvider: StripeProvider
    ) { }

    async handleRefundRequest(participantId: string, session: Session, reason: string) {
        const existingRefundRequest = await this.prismaService.refundRequest.findFirst({
            where: { participant_id: participantId, session_id: session.id }
        });

        if (existingRefundRequest) {
            throw new BadRequestException("Refund request already submitted for this session");
        }

        const refundRequest = await this.prismaService.$transaction(async prisma => {
            const payment = await prisma.payment.findFirst({
                where: { item_id: session.id, buyer_id: participantId, status: PaymentStatus.Succeeded }
            });

            if (!payment) {
                throw new Error("Payment not found for this session");
            }

            // Create a refund request with auto-accepted status
            const refundRequest = await prisma.refundRequest.create({
                data: {
                    participant_id: participantId,
                    session_id: session.id,
                    status: RefundRequestStatus.Accepted,
                    refunded_amount: payment.session_fee,
                    payment_id: payment.id,
                    refund_request_type: RefundRequestType.AutoAccepted,
                    reason
                }
            });

            const createdRefundPayment = await prisma.payment.create({
                data: {
                    payment_type: PaymentType.Refund,
                    buyer_id: participantId,
                    total_amount: payment.total_amount,
                    platform_fee: payment.platform_fee,
                    session_fee: payment.session_fee,
                    item_id: session.id
                }
            });

            await this.stripeProvider.refund(
                createdRefundPayment.session_fee,
                createdRefundPayment.id,
                createdRefundPayment.item_id!,
                createdRefundPayment.buyer_id!
            );

            const updatedParticipant = await prisma.sessionParticipant.update({
                where: { id: participantId, session_id: session.id },
                data: { payment_status: ParticipantPaymentStatus.Refunded }
            });

            return refundRequest;
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
                    title: "Refund Request Accepted",
                    message: `Your refund request for session "${session.title}" has been accepted. You will receive the refunded payment within 2-7 working days`
                });
            }
        } catch (err) {
            console.log("Failed to send refund notification:", err);
        }

        return refundRequest;


    }

}