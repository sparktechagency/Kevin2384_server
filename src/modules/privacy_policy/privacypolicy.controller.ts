import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CreateUpdatePolicyDto } from "./dtos/create-update-policy.dto";
import { Roles } from "src/common/decorators/role.decorator";
import { UserRole } from "generated/prisma/enums";
import { PrivacyPolicyService } from "./privacypolicy.service";
import { GetSitePolicyDto } from "./dtos/get-site-policy.dto";
import { Public } from "src/common/decorators/public.decorator";
import { plainToInstance } from "class-transformer";
import { PolicyResponseDto } from "./dtos/policy-response.dto";

@Controller({
    path:"site-policy"
})
export class PrivacyPolicyController{

    constructor(private readonly privacyPolicyService:PrivacyPolicyService){}

    @Roles(UserRole.ADMIN)
    @Post()
    async createUpdatePolciy( @Body() createUpdatePolicyDto:CreateUpdatePolicyDto){
        const updatedPolicy = await this.privacyPolicyService.updateCreatePolicy(createUpdatePolicyDto)

        return updatedPolicy
    }

    @Get(":type")
    @Public()
    async getSitePOlicy(@Param() getPolicyDto:GetSitePolicyDto){
        const result = await this.privacyPolicyService.getSitePolicy(getPolicyDto.type)

        return plainToInstance(PolicyResponseDto, result, {
            excludeExtraneousValues: true
        })
    }

}