import { Body, Controller, Get, Param, Post, Query, Req, Res } from "@nestjs/common";
import { TokenPayload } from "../auth/types/TokenPayload.type";
import { PaymentService } from "./payment.service";
import { Roles } from "src/common/decorators/role.decorator";
import { UserRole } from "generated/prisma/enums";
import { CreatePaymentDto } from "./dtos/create-payment.dto";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { plainToInstance } from "class-transformer";
import { PaymentResponseDto } from "./dtos/payment-response.dto";
import { RefundResponseDto } from "./dtos/refund-response.dto";

@Controller({
    path:"payments"
})
export class PaymentController{

    constructor(private readonly paymentService:PaymentService){}

    @Post("configure")
    @Roles(UserRole.COACH)
    async configureStripeAccount(@Req() request:Request){
        const tokenPayload = request['payload'] as TokenPayload
        const result = await this.paymentService.configureStripeAccount(tokenPayload.id)
        
        return result

    }

    @Post("init")
    @Roles(UserRole.PLAYER)
    async createPaymentSession(@Req() request:Request, @Body() body:CreatePaymentDto){

        const checkoutSession = await this.paymentService.createPayment(body)

        return checkoutSession
    }

    @Get("stats")
    @Roles(UserRole.COACH)
    async getPaymentOverview(@Req() request:Request){
        const tokenPayload = request['payload'] as TokenPayload

        const result = await this.paymentService.getCoachPaymentStats(tokenPayload.id)

        return result
    }

    @Get("coach")
    @Roles(UserRole.COACH)
    async getCoachPaymentsData(@Req() request:Request, @Query() paginationDto:PaginationDto){

        const tokenPayload = request['payload'] as TokenPayload

        const result = await this.paymentService.getCoachPayments(tokenPayload.id, paginationDto)

        return plainToInstance(PaymentResponseDto, result, {
            excludeExtraneousValues: true
        })
    }

    @Get("coach/refunds")
    @Roles(UserRole.COACH)
    async getCoachRefundsData(@Req() request:Request, @Query() paginationDto:PaginationDto){

        const tokenPayload = request['payload'] as TokenPayload

        const result = await this.paymentService.getCoachRefunds(tokenPayload.id, paginationDto)

        return plainToInstance(RefundResponseDto, result, {
            excludeExtraneousValues: true
        })
    }
}