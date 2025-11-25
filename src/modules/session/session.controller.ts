import { Body, Controller, Get, Post, Query, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { ResponseMessage } from "src/common/decorators/apiResponseMessage.decorator";
import { CreateSessionDto } from "./dtos/create-session.dto";
import { SessionService } from "./session.service";
import { TokenPayload } from "../auth/types/TokenPayload.type";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { CoachSessionDto } from "./dtos/get-upcoming-session.dto";
import { CoachUpcomingSessionResponseDto } from "./dtos/upcoming-session-response.dto";
import { SessionQueryDto } from "./dtos/session-query.dto";
import { EnrollSessionDto } from "./dtos/enroll-session.dto";
import { CancelSessionDto } from "./dtos/cancel-session.dto";
import { UserRole } from "generated/prisma/enums";

@Controller({path:"sessions"})
export class SessionController {

    constructor(private readonly sessionService:SessionService){}
    @UseInterceptors(FileInterceptor("banner", {
        limits: { files: 1, fileSize:1000000 },
        storage: diskStorage({
            destination:'./uploads/session_banner',
            filename:(req, file, callback) => {
                callback(null, file.originalname)
            },
        
        })

    }))

    @Post()
    @ResponseMessage("session created succesfully")
    async createSession(@Body() createSessionDto:CreateSessionDto, @Req() request:Request, @UploadedFile() banner:Express.Multer.File){
        const payload = request['payload'] as TokenPayload
        
        const createdSession = await this.sessionService.createSession(payload.id, createSessionDto, banner)

        return createdSession
    }

    @Get()
    async getSessions( @Req() request:Request,@Query() sessionQuery:SessionQueryDto){
        const tokenPayload = request['payload'] as TokenPayload
        console.log(sessionQuery)
        const sessionsByRadius =  await this.sessionService.getSessions(tokenPayload.id, sessionQuery)

        return sessionsByRadius

    }

    async updateSession(){

    }

    async deleteSession(){}

    @Get("coach")
    @ResponseMessage("coach upcoming session fetched successfully")
    async getUpcomingSessions( @Req() request:Request, @Query() pagination:PaginationDto){
        const  tokenPayload = request['payload'] as TokenPayload

        const upcomingSesions = await this.sessionService.getCoachUpcomingSessions(tokenPayload.id, pagination)

        return plainToInstance(CoachUpcomingSessionResponseDto, upcomingSesions, {
            excludeExtraneousValues:true
        })
    }

    
    @Post("join")
    @ResponseMessage("User enrolled successfully")
    async enrollSession(@Req() request:Request, @Body() enrollSessionDto:EnrollSessionDto){
        const tokenPayload = request['payload'] as TokenPayload

        const enrollResult = await this.sessionService.enrollSession(tokenPayload.id, enrollSessionDto)

        return enrollResult
    }

    @Post("/cancel")
    @ResponseMessage("session cancelled successfully")
    async cancelSession(@Req() request:Request, @Body() cancelSessionDto:CancelSessionDto){

        const tokenPayload = request['payload'] as TokenPayload
        
        return await this.sessionService.cancelSession(tokenPayload.id, cancelSessionDto)
            
    }

    

}