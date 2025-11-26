import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
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
import { STATUS_CODES } from "http";

@Controller({
path:"users",
})
export class UserController {

    constructor(private readonly userService:UserService){}

    // @Post()
    // async addUser(@Body() createUserDto:CreateUserDto){
    //     const user = await this.userService.addOneUser(createUserDto)

    //     return user
    // }
    @Get()
    async getAllUSers(@Query() query:UserQueryDto){
        
        const data = await this.userService.getUsers(query)
  
        return plainToInstance(AllUsersResponseDto,data, {
            excludeExtraneousValues:true
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

                const [_, ext] = file.originalname.split(".")

                const tokenPayload = req['payload'] as TokenPayload

                cb(null, `avatar_${tokenPayload.id}.${ext}`)
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
    async initiateResetPasswordRequest(@Body() forgetPasswordDto:ForgetPasswordDto){
        const result = await this.userService.initiateResetPasswordRequest(forgetPasswordDto)

        return result
    }

    @Post("verify-otp")
    @ResponseMessage("Otp verified successfully")
    @HttpCode(HttpStatus.OK)
    async verifyOtp(@Body() verifyOtpDto:VerifyOtpDto){
        const result = await this.userService.verifyResetPasswordRequest(verifyOtpDto)

        return result
    }   

    @Patch("reset-password")
    @ResponseMessage("Password updated successfully")
    async resetPassword(@Body() resetPasswordDto:ResetPasswordDto){

        const updatedUser = await this.userService.resetPassword(resetPasswordDto)

        return plainToInstance(UserResponseDto, updatedUser, {
            excludeExtraneousValues: true
        })
    }

}