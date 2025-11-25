import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { SessionBuilder } from "./providers/SessionBuilder.provider";
import { CreateSessionDto } from "./dtos/create-session.dto";
import { PrismaService } from "../prisma/prisma.service";
import { title } from "process";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { CoachSessionDto } from "./dtos/get-upcoming-session.dto";
import { GetEnrolledPlayerDto } from "./dtos/get-enrolled-player.dto";
import { ParticipantPaymentStatus, PaymentMethod, SessionStatus } from "generated/prisma/enums";
import { EnrollSessionDto } from "./dtos/enroll-session.dto";
import { UpdateSessionDto } from "./dtos/update-session.dto";
import { CancelSessionDto } from "./dtos/cancel-session.dto";
import { SessionQueryDto } from "./dtos/session-query.dto";
import type { SessionCancelStrategy } from "./strategies/SessionCancelStrategy.interface";
import { CoachCancelStrategy } from "./strategies/CoachCancelStrategy";
import { PlayerCancelStrategy } from "./strategies/PlayerCancelStrategy";

@Injectable()
export class SessionService {

    constructor (
        private readonly sessionBuilder:SessionBuilder,
        private readonly prismaService:PrismaService,

        @Inject(CoachCancelStrategy.INJECTION_KEY)
        private readonly coachCancelStrategy:SessionCancelStrategy,

        @Inject(PlayerCancelStrategy.INJECTION_KEY)
        private readonly playerCancelStrategy:SessionCancelStrategy

    ){}

    
    /**
     * a coach can create session
     * @param userId 
     * @param createSessionDto 
     * @param file 
     * @returns session object
     */
    async createSession(userId:string, createSessionDto:CreateSessionDto, file?:Express.Multer.File){
        
        
        /**
         * use session builder to create session object
         */
        const sessionBuilder  = this.sessionBuilder
        
        .setCoach(userId)
        .setTitle(createSessionDto.title)
        .setDescription(createSessionDto.description)
        .setLocation({lat:createSessionDto.location[0], long:createSessionDto.location[1]})
        .setEquipments(createSessionDto.equipments)
        .setObjectives(createSessionDto.objectives)
        .setFee(createSessionDto.fee)
        .setMaxParticipant(createSessionDto.max_participants)
        .setMinimumAge(createSessionDto.min_age)
        .setStartTime(createSessionDto.start_date, createSessionDto.start_time)
        .setBanner(file)
        .setAddress(createSessionDto.address)
    
        return await this.prismaService.session.create({data:sessionBuilder.build()})
    }


    /**
     * 
     */
    async getSessions(userId:string , sessionQuery:SessionQueryDto){

        const skip = ( sessionQuery.page - 1 ) * sessionQuery.limit


        const sessions = await this.prismaService.session.findMany({
            where:{title:{contains:sessionQuery.query}, status:SessionStatus.CREATED}, 
            skip, 
            take:sessionQuery.limit})

  

        return sessions

    }

    
    /**
     * get coach sessions in three days.
     * sort the session based on the start time of the sessions
     * include how many space left for a session
     * 
     * @param coachId 
     * @param pagination 
     * @returns 
     */
    async getCoachUpcomingSessions(coachId:string, pagination:PaginationDto){

       // window for upcoming sessions
        const upcomingWindow = this.upcomingSessionWindow(3)

        const skip = (pagination.page - 1) * pagination.limit

        const sessions = await this.prismaService.session.findMany({
            where:{coach_id:coachId, started_at:upcomingWindow, status:SessionStatus.CREATED},
            orderBy:{started_at:"desc"}, 
            skip, 
            take:pagination.limit,
            
        })

        const sessionWithJoinDetails = await Promise.all (sessions.map(async session => {
        
            const joindParticipant = await this.prismaService.sessionParticipant.count({where:{session_id:session.id}})

            return {session , left:session.max_participants - joindParticipant}
        }))

        return sessionWithJoinDetails

    }


    /**
     * A window from current day to windwLength 
     * 
     * @param windowLength 
     * @returns 
     */
    private upcomingSessionWindow(windowLength:number ) {
        const currentDate = new Date(Date.now())
        const afterThreeDays = new Date(currentDate.getTime() + windowLength * 24 * 60 * 1000)

        return {gte:currentDate, let:afterThreeDays}
    }


    /**
     * get coach available sesions
     * 
     * available sessions are where no player has enrolled yet
     * 
     * @param coachAvailableSessionDto 
     * @param pagination 
     * @returns 
     */
    async getAvailableSessions(coachAvailableSessionDto:CoachSessionDto, pagination:PaginationDto) {
         const skip = (pagination.page - 1) * pagination.limit

        const sessions = await this.prismaService.session.findMany({
            where:{coach_id:coachAvailableSessionDto.coachId, participants:{none:{}}},
            skip,
            take:pagination.limit
        })

        return sessions
    }


    /**
     * get coach active sessions
     * active sessions are where at least one player has enrolled
     * 
     * @param coachActiveSessionDto 
     * @param pagination 
     * @returns 
     */
    async getActiveSessions(coachActiveSessionDto:CoachSessionDto, pagination:PaginationDto){

        const skip = (pagination.page - 1) * pagination.limit
        const sessions = await this.prismaService.session.findMany({
            where:{coach_id:coachActiveSessionDto.coachId, participants:{some:{}}},
            include:{_count:{select:{participants:true}}}, 
            skip, 
            take:pagination.limit
        })

        const mappedActiveSession = sessions.map( session => {
            const {_count, ...sessionDetails} = session

            return {session:sessionDetails, joind:_count.participants}
        })

        return mappedActiveSession

    }


    /**
     * update a session
     * @param sessionId
     * @returns 
     */

    async updateSession(userId:string, updateSessionDto:UpdateSessionDto){
        const session  = await this.prismaService.session.findUnique({where:{id:updateSessionDto.sessionId}})

        if(!session){
            throw new NotFoundException("session not found!")
        }

        if(session.coach_id !== userId){
            throw new UnauthorizedException("Sorry!, you are not allowed to update this session")
        }

        const updatedData: Record<string, any> = {

            title: updateSessionDto.title ?? session.title,
            description: updateSessionDto.description ?? session.description,
            equipments: updateSessionDto.equipments ?? session.equipments,
            objectives: updateSessionDto.objectives ?? session.objectives,
            additional_notes: updateSessionDto.additional_notes ?? session.additional_notes,
            max_participants: updateSessionDto.max_participants ?? session.max_participants,
            participant_min_age: updateSessionDto.min_age ?? session.participant_min_age,
            fee: updateSessionDto.fee ?? session.fee,
            address: updateSessionDto.address ?? session.address,
        }

        if (updateSessionDto.location) {
            updatedData.location = {type:"Point",coordinates:updateSessionDto.location}
        }

        const updatedSession = await this.prismaService.session.update({where:{id:session.id}, data:updatedData})


        // Notify participant that this session is updated
        

        return updatedSession

    }
    
    /**
     * 
     * @param userId 
     * @param cancelSessionDto 
     * @returns 
     */

    async cancelSession(userId:string, cancelSessionDto:CancelSessionDto){

        const user = await this.prismaService.user.findUnique({where:{id:userId}})

        if(!user){
            throw new NotFoundException("user not found")
        }

        if(user.role  === "COACH"){
            return await this.cancelSessionByCoach(user.id, cancelSessionDto)
        }

        return await this.cancelEnrolledSessionByPlayer(user.id, cancelSessionDto)
    }


    /**
     * 
     * @param userId 
     * 
     * @param cancelSessionDto 
     */
    async cancelSessionByCoach (userId:string, cancelSessionDto:CancelSessionDto){

        const session = await this.prismaService.session.findFirst({where:{id:cancelSessionDto.sessionId}, include:{participants:true}})

        if(!session){
            throw new NotFoundException("session not found")
        }

        if(session.coach_id !== userId){
            throw new UnauthorizedException("Sorry!, you are not allowed to delete this session.")
        }

        
        if(session.started_at <= new Date(Date.now())){
            throw new BadRequestException("Sorry! This session can not be cancelled")
        }

        //invoke coach cancelStrategy to handle session cancellation request
        await this.coachCancelStrategy.handleCancelRequest(userId,session, session.participants)


    }

    /**
     * 
     * @param userId 
     * @param cancelSessionDto 
     */

    async cancelEnrolledSessionByPlayer (userId:string, cancelSessionDto:CancelSessionDto){

        const session = await this.prismaService.session.findFirst({where:{id:cancelSessionDto.sessionId}, include:{participants:{where:{player_id:userId}}}})

        if(!session){
            throw new NotFoundException("session not found")
        }

        if(session.participants.length <= 0){
            throw new BadRequestException("Sorry! you are not enrolled yet.")
        }

        //invoke player cancelStrategy to handle session cancellation request
        await this.playerCancelStrategy.handleCancelRequest(userId,session, session.participants[0])

    }


    /**
     * A player enroll a session if
     * 
     * Session does not reached it's maximum participant
     * 
     * player already joined the session
     * 
     * session is open to receive new participant
     * 
     * @param playerId 
     * @param enrollSessionDto 
     * @returns 
     */
    async enrollSession(playerId:string, enrollSessionDto:EnrollSessionDto){

        

        if(!(await this.isSessionValidToJoin(playerId, enrollSessionDto.sessionId))){
            throw new BadRequestException("session does not exist or no slot available")
        }

        if(await this.playerAlreadyEnrolled(playerId, enrollSessionDto.sessionId)){
            throw new BadRequestException("you are already enrolled in this session")
        }

        const sessionParticipant = await this.prismaService.sessionParticipant.create({
            data:{player_id:playerId,
                 session_id:enrollSessionDto.sessionId, 
                 payment_method:enrollSessionDto.paymentMethod,
                 payment_status:ParticipantPaymentStatus.Pending,

            }})
            // redirect the user to payment page if payment method is online
        if(sessionParticipant.payment_method === PaymentMethod.ONLINE){

            return "User will redirect to payment page"
        }

        return sessionParticipant

    }



   /**
    * Players who are enrolled at any session of that coach.
    * Player payment status are completed or peding that means he will pay at the field.
    * @param getEnrolledPlayer 
    * @returns 
    */
    async getEnrolledPlayers (getEnrolledPlayer:GetEnrolledPlayerDto){

        const enrolledPlayer = await this.prismaService.sessionParticipant.findMany({
            where:{session:{coach_id:getEnrolledPlayer.coachId}, 
                OR:[{payment_status:ParticipantPaymentStatus.Cash},
                    {payment_status:ParticipantPaymentStatus.Paid}]},
            include:{player:true, session:true}
        })

        return enrolledPlayer
        
    }


    /**
     * Players who are enrolled at any session of that coach
     * player payment status is cancelled
     * @param getCancelledPlayer 
     * @returns 
     */
     async getCancelledPlayer (getCancelledPlayer:GetEnrolledPlayerDto){

        const enrolledPlayer = await this.prismaService.sessionParticipant.findMany({
            where:{session:{coach_id:getCancelledPlayer.coachId},payment_status:ParticipantPaymentStatus.Refunded},
            include:{player:true, session:true}
        })

        return enrolledPlayer
        
    }


    /**
     * 
     * @param sessionId 
     * @returns 
     */
    private async isSessionValidToJoin(playerId:string, sessionId:string){

        const session = await this.prismaService.session.findUnique({

            where:{id:sessionId, status:SessionStatus.CREATED}, 
            include:{_count:{select:{
                participants:{
                    where:{OR:[{payment_status:ParticipantPaymentStatus.Cash}, 
                        {payment_status:ParticipantPaymentStatus.Paid}

                        ]}
                }
            }}}
        })

        return session && session.coach_id !== playerId && session._count.participants < session.max_participants

    }
    

    /**
     * 
     * @param playerId 
     * @param sessionId 
     * @returns boolean
     */
    private async playerAlreadyEnrolled(playerId:string, sessionId:string){

        const participant = await this.prismaService.sessionParticipant.count({where:{player_id:playerId, session_id:sessionId}})

        return participant > 0 ? true : false
    }



}