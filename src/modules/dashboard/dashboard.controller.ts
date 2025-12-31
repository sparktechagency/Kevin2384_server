import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { ResponseMessage } from "src/common/decorators/apiResponseMessage.decorator";
import { Roles } from "src/common/decorators/role.decorator";
import { UserRole } from "generated/prisma/enums";
import { TokenPayload } from "../auth/types/TokenPayload.type";
import { PaginationDto } from "src/common/dtos/pagination.dto";

@Controller({
    path:"dashboard"
})
@Roles(UserRole.ADMIN)
export class DashboardController {

    constructor(private readonly dashboardService:DashboardService){}

    @Get("overview")
    @ResponseMessage("overview fetched successfully")
    async getOverview(){
        const result = await this.dashboardService.getOverview()

        return result
    }

    @Post("fee")
    @ResponseMessage("Platfom fee updated!")
    async setPlatformfee(@Req() request:Request, @Body("fee") fee:number){
        const tokenPayload = request['payload'] as TokenPayload

        const addedFee = await this.dashboardService.setPlatFormFee(tokenPayload.id, fee)

        return addedFee
    }

    @Get("fee")
    @ResponseMessage("Platfom fee found!")
    async getPlatformfee(@Req() request:Request){
        const tokenPayload = request['payload'] as TokenPayload

        const addedFee = await this.dashboardService.getPlatFormFee(tokenPayload.id)

        return addedFee
    }

    @Get("reports")
    @ResponseMessage("Reports found!")
    async getReports(@Req() request:Request, @Query() pagination:PaginationDto){

        const tokenPayload = request['payload'] as TokenPayload

        const {reports, total} = await this.dashboardService.getReports(tokenPayload.id, pagination)

        return {reports, total}
    }

    async searchReports(@Req() request:Request, @Query() searchQuery:any){

    }


    @Patch("reports/:reportId")
    @ResponseMessage("reply to report sent successfully")
    async replyToReport(@Req()request:Request, @Param("reportId") reportId:string, @Body("reply") reply:string){

        const tokenPayload = request['payload'] as TokenPayload
        console.log(reportId)
        const repliedReport = await this.dashboardService.replyToReport(tokenPayload.id,reportId, reply)

        return repliedReport
    }
}   
