import { Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { ResponseMessage } from "src/common/decorators/apiResponseMessage.decorator";
import { CreateSessionDto } from "./dtos/create-session.dto";
import { SessionService } from "./session.service";
import { TokenPayload } from "../auth/types/TokenPayload.type";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { CoachUpcomingSessionResponseDto } from "./dtos/upcoming-session-response.dto";
import { SessionQueryDto } from "./dtos/session-query.dto";
import { EnrollSessionDto } from "./dtos/enroll-session.dto";
import { CancelSessionDto } from "./dtos/cancel-session.dto";
import { Roles } from "src/common/decorators/role.decorator";
import { UpdateSessionDto } from "./dtos/update-session.dto";
import { Session } from "generated/prisma/client";
import { UserRole } from "generated/prisma/enums";
import { SessionResponseDto } from "./dtos/session-response.dto";
import { SessionQueryResponseDto } from "./dtos/session-query-response.dto";
import { GetEnrolledPlayerResponseDto } from "./dtos/get-enrolled-player-response.dto";
import { randomUUID } from "node:crypto";
import { GetPlayerEnrolledSessionDto } from "./dtos/get-player-enrolled-session.dto";
import { PlayerEnrolledSessionDto } from "./dtos/player-enrolled-session-response.dto";
import { SessionDetailsParamsDto } from "./dtos/session-details-params.dto";
import { AvailableSessionResponseDto } from "./dtos/available-sesion-response.dto";
import { ActiveSessionResponseDto } from "./dtos/active-session-response.dto";
import { AdminSessionResponseDto } from "./dtos/admin-session-response.dto";

@Controller({path:"sessions"})
export class SessionController {

    constructor(private readonly sessionService:SessionService){}

    @UseInterceptors(FileInterceptor("banner", {
        limits: { files: 1 },
        storage: diskStorage({
            destination:'./uploads/session_banner',
            filename:(req, file, callback) => {
                const uuid = randomUUID().toString()
                const [_, ext] = file.originalname.split(".")
                callback(null, `banner_${uuid}.${ext}`)
            },
        })

    }))

    @Post()
    @ResponseMessage("session created succesfully")
    @Roles(UserRole.COACH)
    async createSession(@Body() createSessionDto:CreateSessionDto, @Req() request:Request, @UploadedFile() banner:Express.Multer.File){
        const payload = request['payload'] as TokenPayload

        console.log("Create session: ",createSessionDto)
        
        const createdSession = await this.sessionService.createSession(payload.id, createSessionDto, banner)

        return plainToInstance(SessionResponseDto, createdSession, {
            excludeExtraneousValues: true,
            groups:["public"]
        })
    }

    /**
     * 
     * @param request 
     * @param sessionQuery 
     * @returns 
     */

    @Get()
    @Roles(UserRole.PLAYER)
    @ResponseMessage("Sessions fetched successfully")
    async getSessions( @Req() request:Request, @Query() sessionQuery:SessionQueryDto){
        const tokenPayload = request['payload'] as TokenPayload
    
        const sessionsByRadius =  await this.sessionService.getSessions(tokenPayload.id, sessionQuery)


        return plainToInstance(SessionQueryResponseDto, sessionsByRadius, {
            excludeExtraneousValues: true,
            groups:["short"]
        })

    }

    /**
     * Updates an existing session.
     *
     * @param {Request} request - The incoming request object.
     * @param {UpdateSessionDto} updateSessionDto - Data transfer object containing the session updates.
     * @returns {Session} The updated session instance.
     */
    @UseInterceptors(FileInterceptor("banner", {
        limits: { files: 1, fileSize:1000000 },
        storage: diskStorage({
            destination:'./uploads/session_banner',
            filename:(req, file, callback) => {
                const uuid = randomUUID().toString()
                const [_, ext] = file.originalname.split(".")
                callback(null, `banner_${uuid}.${ext}`)
            },
        })

    }))

    @Patch()
    @Roles(UserRole.COACH)
    @ResponseMessage("Session Updated Successfully")
    async updateSession(@Req() request:Request, @Body() updateSessionDto:UpdateSessionDto, @UploadedFile() file?:Express.Multer.File): Promise<Session>{
        const tokenPayload = request['payload'] as TokenPayload

        const updatedSession = await this.sessionService.updateSession(tokenPayload.id,updateSessionDto, file)

        return updatedSession
    }

    /**
     * 
     */

    @Roles(UserRole.ADMIN)
    async deleteSession(){}
    
    /**
     * 
     * @param request Request - The incoming request object.
     * @param pagination PaginationDto - Pagination query object.
     * @returns CoachUpcomingSessionResponseDto - Session response dto object.
     */
    @Get("coach")
    @ResponseMessage("coach upcoming session fetched successfully")
    @Roles(UserRole.COACH)
    async getUpcomingSessions( @Req() request:Request, @Query() pagination:PaginationDto){
        const  tokenPayload = request['payload'] as TokenPayload

        const upcomingSesions = await this.sessionService.getCoachUpcomingSessions(tokenPayload.id, pagination)

        return plainToInstance(CoachUpcomingSessionResponseDto, upcomingSesions, {
            excludeExtraneousValues:true,
            groups:["short"]
        })
    }
    /**
     * 
     * @param request 
     * @param pagination 
     * @returns 
     */

    @Get("available")
    @ResponseMessage("Available sessions fetched successfully")
    @Roles(UserRole.COACH)

    async getAvailableSessions(@Req() request:Request, @Query() pagination:PaginationDto){
        const tokenPayload = request['payload'] as TokenPayload

        const sessions = await this.sessionService.getAvailableSessions(tokenPayload.id, pagination)

        return plainToInstance(AvailableSessionResponseDto, sessions, {    
            excludeExtraneousValues: true,
            groups:["coach", "public"]
        })

    }

    /**
     * 
     * @param request 
     * @param pagination 
     * @returns 
     */

    @Get("active")
    @ResponseMessage("Active sessions fetched successfully")
    @Roles(UserRole.COACH)

    async getActiveSessions(@Req() request:Request, @Query() pagination:PaginationDto){
        const tokenPayload = request['payload'] as TokenPayload

        const sessions = await this.sessionService.getActiveSessions(tokenPayload.id, pagination)

        return plainToInstance(ActiveSessionResponseDto, sessions, {    
            excludeExtraneousValues: true,
            groups:["coach", "public"]
        })

    }

    /**
     * 
     * @param request Request
     * @param enrollSessionDto EnrollSessionDto
     * @returns 
     */
    @Post("join")
    @ResponseMessage("User enrolled successfully")
    @Roles(UserRole.PLAYER)
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

    @Get("enrolled-players/:sessionId")
    @ResponseMessage("Enrolled players fetched successfully")
    @Roles(UserRole.COACH)
    async getEnrolledPlayers(@Req() request:Request,@Param("sessionId") sessionId:string, @Query() paginationDto:PaginationDto){
        const tokenPayload = request["payload"] as TokenPayload
     
        const enrolledPlayers = await this.sessionService.getEnrolledPlayers(tokenPayload.id,sessionId, paginationDto)

        return plainToInstance(GetEnrolledPlayerResponseDto, enrolledPlayers, {
            excludeExtraneousValues: true,
            groups:["short", "enrolled"]
        }, )
    }

    /**
     * 
     * @param request 
     * @param paginationDto 
     * @returns 
     */

    @Get("cancelled-players/:sessionId")
    @ResponseMessage("Cancelled players fetched successfully")
    @Roles(UserRole.COACH)
    async getCancelledPlayers(@Req() request:Request,@Param("sessionId") sessionId:string, @Query() paginationDto:PaginationDto){
        const tokenPayload = request["payload"] as TokenPayload
     
        const enrolledPlayers = await this.sessionService.getCancelledPlayer(tokenPayload.id,sessionId, paginationDto)

        return plainToInstance(GetEnrolledPlayerResponseDto, enrolledPlayers, {
            excludeExtraneousValues: true,
            groups:["short", "enrolled"]
        }, )
    }

    /**
     * 
     * @param request 
     * @param playerEnrolledSessionDto 
     * @returns 
     */

    @Get("enrolled")
    @ResponseMessage("Player enrolled sessions fetched successfully.")
    @Roles(UserRole.PLAYER)
    async getPlayerEnrolledSessions(@Req() request:Request, @Body() playerEnrolledSessionDto:GetPlayerEnrolledSessionDto){
        const tokenPayload = request['payload'] as TokenPayload

        const ongoingSessions = await this.sessionService.getPlayerEnrolledSessions(tokenPayload.id, playerEnrolledSessionDto)

        return plainToInstance(PlayerEnrolledSessionDto, ongoingSessions, {
            excludeExtraneousValues: true,
            groups:["enrolled", "short"]
        })
    }

    @Get(":sessionId")
    @ResponseMessage("Session details fetched successfully.")
    async getSessionDetailsById(@Req() request:Request, @Param() params:SessionDetailsParamsDto){

        const tokenPayload = request['payload'] as TokenPayload
   
        const session = await this.sessionService.getSessionDetailsById(tokenPayload.id, params.sessionId)

        if(session.coach.id === tokenPayload.id){

            return plainToInstance(SessionResponseDto, session, {
                excludeExtraneousValues:true,
                groups:["public", "coach"]
            })

        }else if (session.participants.find(participant => participant.player_id === tokenPayload.id)){

            return plainToInstance(SessionResponseDto, session, {
                excludeExtraneousValues:true,
                groups:["public", "enrolled"]
            })

        }

        return plainToInstance(SessionResponseDto, session, {
            excludeExtraneousValues:true,
            groups:["public"]
        })
    }

    @Get("admin/all")
    @Roles(UserRole.ADMIN)
    @ResponseMessage("All sessions fetched successfully")
    async getAllSessions(@Query() query:SessionQueryDto){

        const sessions = await this.sessionService.getAllSessions(query)
    
        return plainToInstance(AdminSessionResponseDto, sessions, {
            excludeExtraneousValues:true,
            groups:["admin"]
        })
    }    

    
}