import { Injectable, NotFoundException, RawBodyRequest } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePaymentDto } from "./dtos/create-payment.dto";
import { PaymentStatus, PaymentType, PayoutStatus, SessionStatus } from "generated/prisma/enums";
import { StripeProvider } from "./providers/stripe.provider";
import { PaginationDto } from "src/common/dtos/pagination.dto";

@Injectable()
export class PaymentService {

    constructor(private readonly prismaService:PrismaService, private readonly stripeProvider:StripeProvider){}

    async createPayment(createPaymentDto:CreatePaymentDto){

        const session = await this.prismaService.session.findUnique({where:{id:createPaymentDto.item_id, status:SessionStatus.CREATED}})
       
        if(!session){
            throw new NotFoundException("session not found")
        }

        let platformFee = await this.prismaService.platformFee.findFirst()
        const fee = platformFee? platformFee.fee : 0.0

        const createdPayment = await this.prismaService.payment.create({data:{
            item_id:createPaymentDto.item_id,
            buyer_id:createPaymentDto.participant_id,
            payment_type:createPaymentDto.payment_type,
            total_amount:session.fee + fee,
            platform_fee:fee,
            session_fee:session.fee
        }})

        const checkoutSession = await this.stripeProvider.createCheckoutSession(createdPayment.total_amount,{title:session.title, description:session.description}, createdPayment.id, createPaymentDto.participant_id, createPaymentDto.item_id)

        return checkoutSession
    }

    async configureStripeAccount(userId:string){
        const user = await this.prismaService.user.findUnique({where:{id:userId}})

        if(!user){
            throw new NotFoundException("User not found")
        }

        if(!user.stripe_customer_id){
             const account =  await this.stripeProvider.createStripeAccount()
            user.stripe_customer_id = account.id
            await this.prismaService.user.update({where:{id:userId}, data:{stripe_customer_id:account.id}})
        }

        const account = await this.stripeProvider.retriveAccount(user.stripe_customer_id)

        
        if(account.charges_enabled && account.payouts_enabled){
            return {stripe_configuration:true}
        }

        return await this.stripeProvider.generateAccountLink(account.id)
        
    }

   async getEarningGrowth(year:number): Promise<Array<{ month: number; total: number }>>{
        
        const start = new Date(year, 0, 1)
        const end = new Date(year, 11, 30)

        const results = await this.prismaService.payment.findMany({where:{status:PaymentStatus.Succeeded, createdAt:{gte:start, lte:end}}})
        const monthsData = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 }))
      
        results.forEach(result => {
            let createdMonth = new Date(result.createdAt).getMonth()
            monthsData[createdMonth].total+=result.total_amount
        })

        return monthsData
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

        const totalAmountReceived = payments.reduce((pre, curr) => pre + curr.total_amount, 0)
        const totalRefund = refunds.reduce((pre, curr) => pre + curr.total_amount, 0)

      const totalPending = payouts.reduce((pre, curr) => {
        if((curr.status === PayoutStatus.Hold) || (curr.status === PayoutStatus.Pending))
            return curr.total_amount
        return 0
      }, 0)

      const pending = (totalAmountReceived - totalRefund)

      return {total: totalWithdrawn + pending, withdrawn:totalWithdrawn, pending}
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

                return {...payment, player_name:payment.participant?.player.fullName, session_title:payment.item?.title, amount:payment.total_amount}
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

                return {...payment, player_name:payment.participant?.player.fullName, session_title:payment.item?.title, amount:payment.total_amount}
            })
            return {refunds:mappedRefunds, total}
        })

  

        return refundData
    }

    async processRefund(amount:number, paymentId:string, sessionId:string, participantId:string){

        const refundResult = await this.stripeProvider.refund(amount, paymentId,sessionId, participantId)

        return refundResult
    }

    handleWebhook(stripeSignature:string, request:RawBodyRequest<Request>){

        const webHookResult = this.stripeProvider.handleWebhook(stripeSignature, request)

        return webHookResult
    }


}