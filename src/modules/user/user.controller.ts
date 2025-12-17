import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { UserService } from "./user.service";
import { CreateUserDto } from "./dtos/create-user.dto";
import { UserQueryDto } from "./dtos/user-query.dto";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { plainToInstance } from "class-transformer";
import { UserResponseDto } from "./dtos/user-response.dto";
import { AllUsersResponseDto } from "./dtos/all-usres-response.dto";
import { UpdateUserDto } from "./dtos/update-user.dto";
import { TokenPayload } from "../auth/types/TokenPayload.type";
import { ResponseMessage } from "src/common/decorators/apiResponseMessage.decorator";
import { ChangePasswordDto } from "./dtos/change-password.dto";
import { DeleteAccountDto } from "./dtos/delete-account.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { ForgetPasswordDto } from "./dtos/forget-password.dto";
import { VerifyOtpDto } from "./dtos/verify-otp.dto";
import { ResetPasswordDto } from "./dtos/reset-password.dto";
import { Public } from "src/common/decorators/public.decorator";
import { randomUUID } from "crypto";
import { Roles } from "src/common/decorators/role.decorator";
import { UserRole } from "generated/prisma/enums";
import { TogggleBlockUserDto } from "./dtos/block-user.dto";
import { WarnUserDto } from "./dtos/warn-user.dto";

@Controller({
path:"users",
})
export class UserController {

    constructor(private readonly userService:UserService){}

    /**
     * 
     * @param query 
     * @returns 
     */

    @Get()
    @ResponseMessage("Users fetched successfully")
    // @Roles(UserRole.ADMIN)
    async getAllUSers(@Query() query:UserQueryDto){
        
        const data = await this.userService.getUsers(query)
   
        return plainToInstance(AllUsersResponseDto,data, {
            excludeExtraneousValues:true,
            groups:["admin"]
        })
    }


    /**
     * 
     * @param request 
     * @param updateUserDto 
     * @param file 
     * @returns 
     */

    @UseInterceptors(FileInterceptor("avatar", {
        limits:{files:1},
        storage:diskStorage({
            
           destination:"./uploads/users",

            filename:(req, file,cb) => {
                const uuid = randomUUID().toString()
                const [_, ext] = file.originalname.split(".")

                cb(null, `avatar_${uuid}.${ext}`)
            }
        })
    }))
    @Patch()
    @ResponseMessage("User Updated Successfully")
    async updateUser(@Req() request:Request, @Body() updateUserDto:UpdateUserDto, @UploadedFile() file?:Express.Multer.File){

        const tokenPayload = request['payload'] as TokenPayload

        const updatedResult = await this.userService.updateUser(tokenPayload.id, updateUserDto, file)

        return plainToInstance(UserResponseDto, updatedResult, {
            excludeExtraneousValues: true
        })
    }
    

    @Patch("change-password")
    @ResponseMessage("Password Updated Successfully")
    async changePassword(@Req() request:Request, @Body() chnagePasswprdDto:ChangePasswordDto){
        const tokenPayload = request['payload'] as TokenPayload

        const changePasswordResult = await this.userService.changePassword(tokenPayload.id, chnagePasswprdDto)

        return plainToInstance(UserResponseDto, changePasswordResult, {
            excludeExtraneousValues: true
        })
    }

    @Delete()
    @ResponseMessage("Your account has been deleted")
    async deleteAccount(@Req() request:Request, @Body() deleteAccountDto:DeleteAccountDto){
        const tokenPayload = request['payload'] as TokenPayload

        const deleteResult = await this.userService.deleteAccount(tokenPayload.id, deleteAccountDto)

        return deleteResult
    }

    @Post("forget-password")
    @ResponseMessage("Reset password request sumitted successfully")
    @Public()
    async initiateResetPasswordRequest(@Body() forgetPasswordDto:ForgetPasswordDto){
        const result = await this.userService.initiateResetPasswordRequest(forgetPasswordDto)

        return result
    }

    @Post("verify-otp")
    @ResponseMessage("Otp verified successfully")
    @HttpCode(HttpStatus.OK)
    @Public()
    async verifyOtp(@Body() verifyOtpDto:VerifyOtpDto){
        const result = await this.userService.verifyResetPasswordRequest(verifyOtpDto)

        return result
    }   

    @Patch("reset-password")
    @ResponseMessage("Password updated successfully")
    @Public()
    async resetPassword(@Body() resetPasswordDto:ResetPasswordDto){

        const updatedUser = await this.userService.resetPassword(resetPasswordDto)

        return plainToInstance(UserResponseDto, updatedUser, {
            excludeExtraneousValues: true
        })
    }

    @Patch("admin/toggle-block")
    @ResponseMessage("User block status updated successfully")
    @Roles(UserRole.ADMIN)
    async toggleBlockUser(@Body() toggoleBlockUserDto:TogggleBlockUserDto){
        return this.userService.toggleUserBlockStatus(toggoleBlockUserDto.userId)
    }

    @Post("admin/warn-user")
    @ResponseMessage("User warned successfully")
    @Roles(UserRole.ADMIN)
    async warnUser(@Req() request:Request, @Body() warnUserDto:WarnUserDto){
        const tokenPayload = request['payload'] as TokenPayload


        return this.userService.warnUser(tokenPayload.id, warnUserDto.userId, warnUserDto.reason)
    }

    @Delete("admin/:userId")
    @ResponseMessage("User account deleted successfully")
    @Roles(UserRole.ADMIN)
    async deleUserAccount(@Req() request:Request, @Param("userId") userId:string){
        const tokenPayload = request['payload'] as TokenPayload

        if(tokenPayload.id === userId){
            throw new BadRequestException("Admin cannot delete their own account using this endpoint")
        }

      
        return this.userService.deleteUserById(userId)
    }

}