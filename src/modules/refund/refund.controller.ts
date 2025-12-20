import { Body, Controller, Get, Param, Patch, Req } from "@nestjs/common";
import { RefundService } from "./refund.service";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { TokenPayload } from "../auth/types/TokenPayload.type";
import { Roles } from "src/common/decorators/role.decorator";
import { UserRole } from "generated/prisma/enums";
import { plainToInstance } from "class-transformer";
import { RefundResponseDto } from "./dtos/refund-response.dto";
import { AcceptRefundRequestDto } from "./dtos/accept-request.dto";
import { RejectRefundRequestDto } from "./dtos/reject-request.dto";
import { ResponseMessage } from "src/common/decorators/apiResponseMessage.decorator";

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

    @Patch("accept")
    @Roles(UserRole.ADMIN)
    @ResponseMessage("Request accepted successfully")
    async acceptRefundrequest(@Req() request:Request, @Body() acceptRequestDto:AcceptRefundRequestDto){

        const tokenPayload = request['payload'] as TokenPayload

        const result = await this.refundService.acceptRefundRequest(tokenPayload.id, acceptRequestDto.requestId)

        return result

    }

    @Patch("reject")
    @Roles(UserRole.ADMIN)
    @ResponseMessage("Request rejected!")
    async rejectRefundrequest(@Req() request:Request, @Body() rejectRequestDto:RejectRefundRequestDto){

        const tokenPayload = request['payload'] as TokenPayload

        const result = await this.refundService.rejectRefundRequest(tokenPayload.id, rejectRequestDto.requestId, rejectRequestDto.note)

        return result

    }

}