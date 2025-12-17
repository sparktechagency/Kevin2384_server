import { Controller, Get, Param, Req } from "@nestjs/common";
import { RefundService } from "./refund.service";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { TokenPayload } from "../auth/types/TokenPayload.type";
import { Roles } from "src/common/decorators/role.decorator";
import { UserRole } from "generated/prisma/enums";
import { plainToInstance } from "class-transformer";
import { RefundResponseDto } from "./dtos/refund-response.dto";

@Controller({
    path:"refunds"
})
export class RefundController {

    constructor(private readonly refundService:RefundService){}


    @Get("coach")
    @Roles(UserRole.COACH)
    async getCoachRefundData(@Req() request:Request, @Param() pagination:PaginationDto){

        const tokenPayload = request['payload'] as TokenPayload

        const result = await this.refundService.getCoachRefundData(tokenPayload.id, pagination)

        return plainToInstance(RefundResponseDto, result, {
            excludeExtraneousValues: true
        })
    }

}