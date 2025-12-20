import { BadRequestException, Inject, Injectable, NotFoundException, Query, UnauthorizedException } from "@nestjs/common";
import { SessionBuilder } from "./providers/SessionBuilder.provider";
import { CreateSessionDto } from "./dtos/create-session.dto";
import { PrismaService } from "../prisma/prisma.service";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { CoachSessionDto } from "./dtos/get-upcoming-session.dto";
import { Audience, NotificationLevel, ParticipantPaymentStatus, PaymentMethod, PaymentType, PlayerStatus, SessionStatus, SessionType } from "generated/prisma/enums";
import { EnrollSessionDto } from "./dtos/enroll-session.dto";
import { UpdateSessionDto } from "./dtos/update-session.dto";
import { CancelSessionDto } from "./dtos/cancel-session.dto";
import { SessionQueryDto } from "./dtos/session-query.dto";
import type { SessionCancelStrategy } from "./strategies/SessionCancelStrategy.interface";
import { CoachCancelStrategy } from "./strategies/CoachCancelStrategy";
import { PlayerCancelStrategy } from "./strategies/PlayerCancelStrategy";
import { UserRole } from "generated/prisma/enums";
import { GetPlayerEnrolledSessionDto } from "./dtos/get-player-enrolled-session.dto";
import { UserService } from "../user/user.service";
import { PaymentService } from "../payment/payment.service";
import { SessionNotifier } from "./providers/SessionNotifier.provider";


@Injectable()
export class SessionService {

    constructor (
        private readonly sessionBuilder:SessionBuilder,
        private readonly prismaService:PrismaService,
        private readonly userService:UserService,

        @Inject(CoachCancelStrategy.INJECTION_KEY)
        private readonly coachCancelStrategy:SessionCancelStrategy,

        @Inject(PlayerCancelStrategy.INJECTION_KEY)
        private readonly playerCancelStrategy:SessionCancelStrategy,
        private readonly paymentService:PaymentService,
        private readonly sessionNotifier:SessionNotifier

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

        try{
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
                .setStartAt(createSessionDto.start_date, createSessionDto.start_time)
                .setBanner(file)
                .setAddress(createSessionDto.address)
                .setAdditionalNotes(createSessionDto.additional_notes)
                .setType(createSessionDto.type as SessionType)
            
            const createdNotification =  await this.prismaService.session.create({data:sessionBuilder.build()})

            //create a notification

            this.sessionNotifier.sendNotification(
                userId,
                Audience.USER,
                NotificationLevel.INFO,
                "Your sesssion live now!",
                `Session titled ${createdNotification.title} has been created`,
            )

            return createdNotification

        }catch (err:any){
            throw new BadRequestException(err.message)

        }
       
    }


   /**
    * 
    * @param userId 
    * @param sessionQuery 
    * @returns 
    */
    async getSessions(userId:string , sessionQuery:SessionQueryDto){
        console.log(sessionQuery)
        const skip = ( sessionQuery.page - 1 ) * sessionQuery.limit
        // const targetLocation = {type:"Point", coordinates:sessionQuery.location}
        // const results = await this.prismaService.$runCommandRaw({
        //     aggregate: "sessions",
        //     pipeline: [
        //         {
        //         $search: {
        //             geoWithin: {
        //             circle: {
        //                 center: stargetLocation,
        //                 radius: sessionQuery.radius
        //             },
        //             path: "location"
        //             }
        //         }
        //         }
        //     ],
        //     cursor: {}
        // });


        // console.log(results)s

        const [sessions, total] = await this.prismaService.$transaction(
            [ this.prismaService.session.findMany({
                where:{
                    title:{contains:sessionQuery.query,mode:"insensitive"},
                    participants:{none:{player_id:userId}}, 
                    status:SessionStatus.CREATED}, 
                skip, 
                take:sessionQuery.limit,
                include:{ _count:{select:{participants:true}}}
            }),  
            this.prismaService.session.count({
                where:{title:{contains:sessionQuery.query,mode:"insensitive"},participants:{none:{player_id:userId}}, status:SessionStatus.CREATED}
            })])

        const mappedSessions = sessions.map(session => {

            return {...session, left: session.max_participants - session._count.participants}
        })


        return {sessions:mappedSessions, total}

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


        const [sessions, total] = await this.prismaService.$transaction([
            this.prismaService.session.findMany({
                where:{coach_id:coachId, started_at:upcomingWindow, status:SessionStatus.CREATED},
                orderBy:{started_at:"asc"}, 
                skip, 
                take:pagination.limit,
                include:{_count:{select:{participants:true}}
            }}),
            this.prismaService.session.count({
                where:{coach_id:coachId, started_at:upcomingWindow, status:SessionStatus.CREATED}})
        ])

        const sessionWithJoinDetails = await Promise.all (sessions.map(async session => {
        
            const joindParticipant = await this.prismaService.sessionParticipant.count({where:{session_id:session.id}})

            return {...session , left:session.max_participants - joindParticipant}
        }))

        return {sessions:sessionWithJoinDetails, total}

    }


    /**
     * A window from current day to windwLength 
     * 
     * @param windowLength 
     * @returns 
     */
    private upcomingSessionWindow(windowLength:number ) {
        const currentDate = new Date(Date.now())
        const afterThreeDays = new Date(currentDate.getTime() + windowLength * 24 * 60 * 60 * 1000)

        return {gte:currentDate, lte:afterThreeDays}
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
    async getAvailableSessions(coachId:string, pagination:PaginationDto) {
         const skip = (pagination.page - 1) * pagination.limit

         const [sessions, total] = await this.prismaService.$transaction([
            this.prismaService.session.findMany({
                where:{coach_id:coachId, participants:{none:{}}, status:SessionStatus.CREATED},
                skip,
                take:pagination.limit
            }), 
            this.prismaService.session.count({
                where:{coach_id:coachId, participants:{none:{}}, status:SessionStatus.CREATED}
            })
         ])
        

        return {sessions, total}
    }


    /**
     * get coach active sessions
     * active sessions are where at least one player has enrolled
     * 
     * @param coachActiveSessionDto 
     * @param pagination 
     * @returns 
     */
    async getActiveSessions(coachId:string, pagination:PaginationDto){

        const skip = (pagination.page - 1) * pagination.limit
        const [sessions, total] = await this.prismaService.$transaction([
            this.prismaService.session.findMany({
                where:{coach_id:coachId, participants:{some:{}}, status:SessionStatus.CREATED},
                skip,
                take:pagination.limit,
                include:{_count:{select:{participants:true}}}
            }), 
            this.prismaService.session.count({
                where:{coach_id:coachId, participants:{some:{}}, status:SessionStatus.CREATED}
            })
         ])
        const mappedActiveSession = sessions.map( session => {
            const {_count, ...sessionDetails} = session
            return {...sessionDetails, joined:_count.participants}
        })



        return {sessions:mappedActiveSession, total}

    }


    /**
     * update a session
     * @param sessionId
     * @returns 
     */

    async updateSession(userId:string, updateSessionDto:UpdateSessionDto, file?:Express.Multer.File){
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

        if(file){
            updatedData.banner = file.path
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

        if(user.role  === UserRole.COACH){
            
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
        await this.coachCancelStrategy.handleCancelRequest(userId,session, session.participants, cancelSessionDto.note)


    }

    /**
     * 
     * @param userId 
     * @param cancelSessionDto 
     */

    async cancelEnrolledSessionByPlayer (userId:string, cancelSessionDto:CancelSessionDto){

        const session = await this.prismaService.session.findFirst({
            where:{id:cancelSessionDto.sessionId}, 
            include:{participants:{where:{player_id:userId, player_status:PlayerStatus.Attending, payment_status:ParticipantPaymentStatus.Paid}}}})

        if(!session){
            throw new NotFoundException("session not found")
        }

        if(session.participants.length <= 0){
            throw new BadRequestException("Sorry! you are not enrolled yet.")
        }

        //invoke player cancelStrategy to handle session cancellation request
        await this.playerCancelStrategy.handleCancelRequest(userId,session, session.participants[0], cancelSessionDto.note)

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

        const session = await this.prismaService.session.findUnique({where:{id:enrollSessionDto.sessionId}})

        if(!session){
            throw new NotFoundException("session not found!")
        }
        

        if(!(await this.isSessionValidToJoin(playerId, enrollSessionDto.sessionId))){
            throw new BadRequestException("session is not available to join")
        }

        if(await this.isPlayerAlreadyEnrolled(playerId, enrollSessionDto.sessionId)){
            throw new BadRequestException("you are already enrolled in this session")
        }

        if(session.fee <= 0){
            const enrolledPalyer =  await this.enrollFreeSession(playerId, enrollSessionDto)

            return enrolledPalyer
        }

        const result = await this.prismaService.$transaction(async prisma => {
            const sessionParticipant = await prisma.sessionParticipant.create({
                data:{player_id:playerId,
                session_id:enrollSessionDto.sessionId, 
                payment_method:enrollSessionDto.paymentMethod,
                ...(enrollSessionDto.paymentMethod === PaymentMethod.CASH ? {payment_status:ParticipantPaymentStatus.Cash, player_status:PlayerStatus.Attending}:{})
            }})
        
            // redirect the user to payment page if payment method is online
            if(sessionParticipant.payment_method === PaymentMethod.ONLINE){

                const paymentLink =  await this.paymentService.createPayment({
                    amount:session.fee,
                    item_id:sessionParticipant.session_id,
                    participant_id:sessionParticipant.id,
                    payment_type:PaymentType.Enrollment
                })

                return paymentLink
            }

            return sessionParticipant
        })

        return result

    }


    async enrollFreeSession(playerId:string,enrollSessionDto:EnrollSessionDto){

        const participant = await this.prismaService.$transaction(async prisma => {

            const sessionParticipant = await prisma.sessionParticipant.create({
                data:{
                    player_id:playerId,
                    payment_method:enrollSessionDto.paymentMethod,
                    session_id:enrollSessionDto.sessionId,
                    player_status:PlayerStatus.Attending,
                    payment_status:ParticipantPaymentStatus.Paid
                }
            })

            

            return sessionParticipant

        })
       

        return participant
    }



   /**
    * Players who are enrolled at any session of that coach.
    * Player payment status are completed or peding that means he will pay at the field.
    * @param getEnrolledPlayer 
    * @returns 
    */
    async getEnrolledPlayers (coachId:string,sessionId:string, paginationDto:PaginationDto){

        const skip = (paginationDto.page - 1) * paginationDto.limit

        if(!sessionId || sessionId.includes(":sessionId")){
            throw new BadRequestException("session id is required")
        }

        const [enrolledPlayer, total] = await this.prismaService.$transaction([
            this.prismaService.sessionParticipant.findMany({

            where:{session:{coach_id:coachId, id:sessionId}, player_status:PlayerStatus.Attending},
            orderBy:{createdAt:"desc"},
            include:{player:true, session:true},
            skip,
            take: paginationDto.limit
        }),

        this.prismaService.sessionParticipant.count({

            where:{session:{coach_id:coachId, id:sessionId}, player_status:PlayerStatus.Attending},
            skip,
            take:paginationDto.limit
        })

        ])
        
        return {players:enrolledPlayer, total}
        
    }


    /**
     * Players who are enrolled at any session of that coach
     * player payment status is cancelled
     * @param getCancelledPlayer 
     * @returns 
     */
     async getCancelledPlayer (coachId:string,sessionId:string, paginationDto:PaginationDto){

       const skip = (paginationDto.page - 1) * paginationDto.limit
       
       if(!sessionId || sessionId.includes(":sessionId")){
            throw new BadRequestException("session id is required")
        }

        const [cancelledPlayers, total] = await this.prismaService.$transaction([
            this.prismaService.sessionParticipant.findMany({

            where:{session:{coach_id:coachId, id:sessionId}, player_status:PlayerStatus.Cancelled},
            orderBy:{createdAt:"desc"},

            include:{player:true, session:true},
            skip,
            take: paginationDto.limit
        }),

        this.prismaService.sessionParticipant.count({

            where:{session:{coach_id:coachId, id:sessionId}, player_status:PlayerStatus.Cancelled},
            skip,
            take:paginationDto.limit
        })

        ])
        
        return {players:cancelledPlayers, total}
        
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
                    where:{player_status:PlayerStatus.Attending}
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
    private async isPlayerAlreadyEnrolled(playerId:string, sessionId:string){

        const participant = await this.prismaService.sessionParticipant.count({where:{player_id:playerId, session_id:sessionId}})

        return participant > 0 ? true : false
    }

    /**
     * 
     * @param userId 
     * @param getPlayerSessionDto 
     * @returns 
     */

    async getPlayerEnrolledSessions(userId:string, getPlayerSessionDto:GetPlayerEnrolledSessionDto, pagination:PaginationDto){

        const skip = (pagination.page - 1) * pagination.limit

     
        if (getPlayerSessionDto.status === SessionStatus.ONGOING){

            const [enrolledSessions, total] = await this.prismaService.$transaction([
                this.prismaService.session.findMany({
                where:{participants:{some:{player_id:userId, player_status:PlayerStatus.Attending}}, 
                    OR:[{status:SessionStatus.CREATED}, {status:SessionStatus.ONGOING}]
                    },
                    include:{coach:true},
                    skip,
                    take:pagination.limit
                }),

                this.prismaService.session.count({
                where:{participants:{some:{player_id:userId, player_status:PlayerStatus.Attending}}, 
                    OR:[{status:SessionStatus.CREATED}, {status:SessionStatus.ONGOING}]
                    },
                    skip,
                    take:pagination.limit
                    
                }),

            ])
           
           
        
            return {sessions:enrolledSessions, total}
        }

        const [enrolledSessions, total] = await this.prismaService.$transaction([
                this.prismaService.session.findMany({
                where:{participants:{some:{player_id:userId, player_status:PlayerStatus.Attending}}, 
                    OR:[{status:SessionStatus.CREATED}, {status:SessionStatus.ONGOING}]
                    },
                    include:{coach:true},
                    skip,
                    take:pagination.limit
                }),

                this.prismaService.session.count({
                where:{participants:{some:{player_id:userId, player_status:PlayerStatus.Attending}}, 
                    status:getPlayerSessionDto.status},
                    skip,
                    take:pagination.limit
                }),

            ])

        return {sessions:enrolledSessions, total}
        
    }


    async getSessionDetailsById(userId:string, sessionId:string){

        
        const session = await this.prismaService.session.findUnique({where:{id:sessionId}, include:{coach:true, participants:{where:{player_id:userId}}}})
       
        if(!session){
            throw new NotFoundException("session not found")
        }

        return session
    }

    async getAllSessions(query:SessionQueryDto){

        const skip = (query.page - 1) * query.limit 

        console.log(query)
        
        const [sessions, total] = await  Promise.all([
            this.prismaService.session.findMany({
                where:{status:SessionStatus.CREATED, coach:{fullName:{contains:query.query, mode:'insensitive'}}}, 
                
                orderBy:{createdAt:"desc"},
                include:{_count:{select:{participants:{where:{player_status:PlayerStatus.Attending}}}}, coach:true},
                skip,
                take:query.limit
            }),
            this.prismaService.session.count({where:{status:SessionStatus.CREATED}, skip, take:query.limit})
        ])

        const mappedSessions = sessions.map( session =>{
           const totalJoined = session._count.participants

            return {...session, left:session.max_participants - totalJoined , joined:totalJoined}
         })  
        
    

        return {sessions:mappedSessions, total}
        
    }


}