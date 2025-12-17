import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePaymentDto } from "./dtos/create-payment.dto";
import { PaymentStatus, PaymentType, PayoutStatus } from "generated/prisma/enums";
import { StripeProvider } from "./providers/stripe.provider";
import { PaginationDto } from "src/common/dtos/pagination.dto";

@Injectable()
export class PaymentService {

    constructor(private readonly prismaService:PrismaService, private readonly stripeProvider:StripeProvider){}

    async createPayment(createPaymentDto:CreatePaymentDto){

        const session = await this.prismaService.session.findUnique({where:{id:createPaymentDto.item_id}})

        if(!session){
            throw new NotFoundException("session not found")
        }
        const createdPayment = await this.prismaService.payment.create({data:{
            item_id:createPaymentDto.item_id,
            buyer_id:createPaymentDto.participant_id,
            payment_type:createPaymentDto.payment_type,
            amount:createPaymentDto.amount
        }})

        const checkoutSession = await this.stripeProvider.createCheckoutSession(createdPayment.amount,{title:session.title, description:session.description}, createdPayment.id, createPaymentDto.participant_id, createPaymentDto.item_id)

        return checkoutSession
    }

    async configureStripeAccount(userId:string){

        const {account, onboardingLink} =  await this.stripeProvider.createStripeAccount()

        await this.prismaService.user.update({where:{id:userId}, data:{stripe_customer_id:account.id}})

        return onboardingLink
    }

   async getEarningGrowth(year:number): Promise<Array<{ month: number; total: number }>>{

        const start = new Date(year, 0, 1)
        const end = new Date(year+1, 0, 1)

        const pipeline = [
            {
                $match: {
                    createdAt: { $gte: start, $lt: end },
                    status: PaymentStatus.Succeeded,
                },
            },
            {
                $group: {
                    _id: { $month: "$paymentDate" },
                    total: { $sum: "$amount" },
                },
            },
            { $sort: { _id: 1 } },
        ]

        const results = await this.prismaService.payment.aggregateRaw({pipeline})

        const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 }))
       
        return months
    }

    async getCoachPaymentStats(coachId:string){
        const payouts = await this.prismaService.duePayouts.findMany({where:{coach_id:coachId}})

        const total = payouts.reduce((pre, curr) => pre + curr.total_amount, 0)

        const totalWithdrawn = payouts.reduce((pre, curr) => {
            if(curr.status === PayoutStatus.Paid)
                return curr.total_amount
            return 0
        }, 0)

        const payments = await this.prismaService.payment.findMany({
            where:{item:{coach_id:coachId}, payment_type:PaymentType.Enrollment, status:PaymentStatus.Succeeded}
        })

        const refunds = await this.prismaService.payment.findMany({
            where:{item:{coach_id:coachId}, payment_type:PaymentType.Refund, status:PaymentStatus.Succeeded}
        })

        const totalAmountReceived = payments.reduce((pre, curr) => pre + curr.amount, 0)
        const totalRefund = refunds.reduce((pre, curr) => pre + curr.amount, 0)

      const totalPending = payouts.reduce((pre, curr) => {
        if((curr.status === PayoutStatus.Hold) || (curr.status === PayoutStatus.Pending))
            return curr.total_amount
        return 0
      }, 0)

      return {total, withdrawn:totalWithdrawn, pending:(totalAmountReceived - totalRefund)}
    }

    async getCoachPayments(coachId:string, paginationDto:PaginationDto){

        const skip = (paginationDto.page - 1) * paginationDto.limit

        const paymentData = await this.prismaService.$transaction(async prisma => {
            const payments = await this.prismaService.payment.findMany({
                where:{item:{coach_id:coachId}, status:PaymentStatus.Succeeded, payment_type:PaymentType.Enrollment},
                include:{item:{select:{title:true}}, participant:{select:{player:{select:{fullName:true}}}}},
                skip,
                take:paginationDto.limit,
                orderBy:{createdAt:"desc"}
            })

            const mappedPayments = payments.map(payment => {

                return {...payment, player_name:payment.participant?.player.fullName, session_title:payment.item?.title, amount:payment.amount}
            })
            const total = await this.prismaService.payment.count({
                where:{item:{coach_id:coachId}, status:PaymentStatus.Succeeded}
            })
            return {payments:mappedPayments, total}
        })

  

        return paymentData
    }


    async getCoachRefunds(coachId:string, paginationDto:PaginationDto){
         const skip = (paginationDto.page - 1) * paginationDto.limit

        const refundData = await this.prismaService.$transaction(async prisma => {
            const payments = await prisma.payment.findMany({
                where:{item:{coach_id:coachId}, status:PaymentStatus.Succeeded, payment_type:PaymentType.Refund},
                include:{item:{select:{title:true}}, participant:{select:{player:{select:{fullName:true}}}}},
                skip,
                take:paginationDto.limit,
                orderBy:{createdAt:"desc"}
            })

           
            const total = await prisma.payment.count({
                where:{item:{coach_id:coachId},payment_type:PaymentType.Refund, status:PaymentStatus.Succeeded}
            })

            const mappedRefunds = payments.map(payment => {

                return {...payment, player_name:payment.participant?.player.fullName, session_title:payment.item?.title, amount:payment.amount}
            })
            return {refunds:mappedRefunds, total}
        })

  

        return refundData
    }


}