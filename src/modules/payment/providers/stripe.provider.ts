import { BadRequestException, Inject, Injectable, NotFoundException, RawBodyRequest } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { Audience, NotificationLevel, ParticipantPaymentStatus, PaymentStatus, PlayerStatus } from "generated/prisma/enums";
import stripeConfig, { StripeConfig } from "src/config/stripe.config";
import { NotificationService } from "src/modules/notification/notification.service";
import { PrismaService } from "src/modules/prisma/prisma.service";
import Stripe from "stripe";



type MetaData = {
    paymentId: string
    participantId: string
    sessionId: string
}

@Injectable()
export class StripeProvider {
    private readonly stripeCLient: Stripe

    constructor(
        @Inject(stripeConfig.KEY) private readonly stripeCOnfiguration: ConfigType<typeof StripeConfig>,
        private readonly prismaService: PrismaService,
        private readonly notificationService: NotificationService
    ) {
        if (!stripeCOnfiguration.stripe_key) {
            throw new Error("Stripe intialization failed. Please provde stripe secret key.")
        }

        this.stripeCLient = new Stripe(stripeCOnfiguration.stripe_key, {
            apiVersion: "2025-11-17.clover"
        })
    }


    async createCheckoutSession(amount: number, item: { title: string, description: string }, paymentId: string, participantId: string, sessionId: string) {
        const session = await this.prismaService.session.findUnique({ where: { id: sessionId }, include: { coach: true } })
        if (!session) {
            throw new NotFoundException("session not found")
        }



        const checkoutSession = await this.stripeCLient.checkout.sessions.create({
            mode: 'payment',
            success_url: "http://coachconnect.com/return/success",
            metadata: {
                paymentId,
                participantId,
                sessionId
            },
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: item.title,
                            description: item.description,
                        },
                        unit_amount: amount * 100
                    },
                    quantity: 1
                }
            ],

        })

        return checkoutSession.url
    }

    async createStripeAccount() {

        const account = await this.stripeCLient.accounts.create({
            controller: {
                fees: { payer: 'application' },
                losses: {
                    payments: "application"
                },
                stripe_dashboard: {
                    type: 'express'
                }
            },
        })



        return account
    }

    async generateAccountLink(accountId: string) {

        const onboardingLink = await this.stripeCLient.accountLinks.create({
            account: accountId,
            type: "account_onboarding",
            return_url: "http://google.com",
            refresh_url: "http://google.com",
            collection_options: {
                fields: 'currently_due',
            },

        })

        return onboardingLink
    }

    async checkAccountStatus(accountId: string) {

    }

    async retriveAccount(accountId: string) {
        return await this.stripeCLient.accounts.retrieve(accountId)
    }

    async deleteStripeAccount(accountId: string) {
        try {
            const stripeAccount = await this.retriveAccount(accountId)
            await this.stripeCLient.accounts.del(stripeAccount.id)
        } catch (err) {
            console.log(err)
            throw err
        }

    }

    async transfer(amount: number, accountId: string) {
        try {
            const account = await this.retriveAccount(accountId)
            this.stripeCLient.transfers.create({
                destination: account.id,
                amount: amount,
                currency: "usd",
            })

            console.log("Transfering amount..", accountId)
        } catch (err) {
            console.log("Tranferring amount error!")
            throw err
        }
    }

    async refund(amount: number, paymentId: string, sessionId: string, participantId: string) {
        const payment = await this.prismaService.payment.findUnique({ where: { id: paymentId } })

        if (!payment) {
            throw new Error("Payment not found")
        }
        const paymentIntent = await this.stripeCLient.paymentIntents.retrieve(payment.stripe_intent_id!)

        if (!paymentIntent) {
            throw new Error("Payment intent not found")
        }

        const refund = await this.stripeCLient.refunds.create({
            payment_intent: paymentIntent.id,
            amount: amount,
            metadata: {
                sessionId: sessionId,
                paymentId: paymentId,
                participantId: participantId
            }
        })

        // await this.prismaService.payment.update({
        //     where: { id: paymentId },
        //     data: {
        //         status: PaymentStatus.Refunded
        //     }
        // })
    }

    async handleWebhook(stripe_signature: string, req: RawBodyRequest<Request>) {

        try {


            if (!this.stripeCOnfiguration.webhook_key) {
                throw new BadRequestException("webhook key is required")
            }

            if (!stripe_signature) {
                throw new BadRequestException("stripe signature is missing!")
            }

            const event = this.stripeCLient.webhooks.constructEvent(
                req.rawBody!,
                stripe_signature,
                this.stripeCOnfiguration.webhook_key
            );

            switch (event.type) {

                case "checkout.session.completed": {
                    const { paymentId, participantId, sessionId } = event.data.object.metadata as MetaData

                    const session = await this.prismaService.session.findUnique({ where: { id: sessionId } })


                    if (session) {

                        const [payment, participant] = await this.prismaService.$transaction([
                            this.prismaService.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.Succeeded, stripe_session_id: event.data.object.id, stripe_intent_id: event.data.object.payment_intent?.toString() } }),
                            this.prismaService.sessionParticipant.update({
                                where: { id: participantId }, data: { payment_status: ParticipantPaymentStatus.Paid, player_status: PlayerStatus.Attending }
                            })
                        ])

                        this.notificationService.createNotification({
                            audience: Audience.USER,
                            userId: participant.player_id,
                            level: NotificationLevel.INFO,
                            message: `You enrolled ${session?.title} successfully`,
                            title: "Session enrolled",
                        })

                        this.notificationService.createNotification({
                            audience: Audience.USER,
                            userId: session?.coach_id,
                            level: NotificationLevel.INFO,
                            title: "New Enrollment!",
                            message: `A player booked your ${session?.title} session.`
                        })
                    }
                    break
                }
                case "payment_intent.payment_failed": {
                    let { paymentId, participantId, sessionId } = event.data.object.metadata as MetaData

                    await this.prismaService.$transaction([
                        this.prismaService.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.Failed } }),
                        this.prismaService.sessionParticipant.update({ where: { id: participantId }, data: { payment_status: ParticipantPaymentStatus.Failed, player_status: PlayerStatus.Cancelled } })
                    ])

                    break;
                }
                case "charge.refund.updated": {
                    // Handle refund success
                    const refund = event.data.object;
                    const { paymentId, participantId, sessionId } = refund.metadata as MetaData;

                    if (refund.status === "succeeded") {
                        // Update payment status to refunded
                        await this.prismaService.payment.update({
                            where: { id: paymentId },
                            data: { status: PaymentStatus.Refunded }
                        });

                        // Get participant and session details for notification
                        const [participant, session] = await Promise.all([
                            this.prismaService.sessionParticipant.findUnique({
                                where: { id: participantId },
                                include: { player: true }
                            }),
                            this.prismaService.session.findUnique({
                                where: { id: sessionId }
                            })
                        ]);

                        // Send notification to player
                        if (participant && session) {
                            this.notificationService.createNotification({
                                audience: Audience.USER,
                                userId: participant.player_id,
                                level: NotificationLevel.INFO,
                                title: "Refund Processed",
                                message: `Your refund for session "${session.title}" has been processed successfully. The amount will be credited to your account within 5-10 business days.`
                            });
                        }

                        console.log(`Refund succeeded for payment ${paymentId}, amount: ${refund.amount / 100}`);
                    } else if (refund.status === "failed") {
                        console.error(`Refund failed for payment ${paymentId}`);
                        // Optionally handle failed refunds
                    }

                    break;
                }
                default:

            }


            return event.data

        } catch (err) {
            console.log(err)
            throw err
        }

    }


}