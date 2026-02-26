import { BadRequestException, Inject, Injectable, NotFoundException, Query, UnauthorizedException } from "@nestjs/common";
import { SessionBuilder } from "./providers/SessionBuilder.provider";
import { CreateSessionDto } from "./dtos/create-session.dto";
import { PrismaService } from "../prisma/prisma.service";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { Audience, NotificationLevel, ParticipantPaymentStatus, PaymentMethod, PaymentType, PlayerStatus, RefundRequestStatus, SessionStatus, SessionType } from "generated/prisma/enums";
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
import { getDistance } from "geolib";
import { S3FIle } from "src/common/types/S3File.type";
import { NotificationService } from "../notification/notification.service";
import { ReportSessioDto } from "./dtos/report-session.dto";
import { RefundRequestResolver } from "../refund/providers/RefundRequestResolver.provider";
import { ByWeekday, Frequency, RRule } from "rrule";
import { DAYS } from "./enums/days";
import { SESSION_CONSTANTS } from "./constants";
import { WarnCoachDto } from "./dtos/coach-warn.dto";
import { AdminCancelStrategy } from "./strategies/AdminCancelStrategy";

// Constants
const MILES_TO_METERS = 1609.34;
const UPCOMING_SESSIONS_WINDOW_DAYS = 3;

@Injectable()
export class SessionService {

    constructor(
        private readonly sessionBuilder: SessionBuilder,
        private readonly prismaService: PrismaService,
        private readonly userService: UserService,

        @Inject(CoachCancelStrategy.INJECTION_KEY)
        private readonly coachCancelStrategy: SessionCancelStrategy,

        @Inject(PlayerCancelStrategy.INJECTION_KEY)
        private readonly playerCancelStrategy: SessionCancelStrategy,
        @Inject(AdminCancelStrategy.INJECTION_KEY)
        private readonly adminCancelStrategy: SessionCancelStrategy,

        private readonly paymentService: PaymentService,
        private readonly sessionNotifier: SessionNotifier,
        private readonly notificationService: NotificationService,
        private readonly refundRequestResolver: RefundRequestResolver

    ) { }

    /**
     * Helper method to calculate pagination parameters
     * @param pagination PaginationDto
     * @returns Object with skip and take values
     */
    private getPaginationParams(pagination: PaginationDto) {
        const skip = (pagination.page - 1) * pagination.limit;
        const take = pagination.limit;
        return { skip, take };
    }

    /**
     * a coach can create session
     * @param userId 
     * @param createSessionDto 
     * @param file 
     * @returns session object
     */
    async createSession(userId: string, createSessionDto: CreateSessionDto, file?: S3FIle) {
        try {
            const user = await this.validateUserCanCreateSession(userId);

            if (createSessionDto.is_recurrent) {
                return await this.createRecurrentSessions(userId, createSessionDto, file);
            } else {
                return await this.createSingleSession(userId, createSessionDto, file);
            }
        } catch (err: any) {
            console.log(err);
            throw new BadRequestException(`Session Creation Failed: ${err.message}`);
        }
    }

    /**
     * Validates if user can create a session
     * @param userId 
     * @returns User object if valid
     */
    private async validateUserCanCreateSession(userId: string) {
        const user = await this.prismaService.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException("user not found");
        }
        if (user.is_blocked) {
            throw new UnauthorizedException("Sorry, You are not allowed to create session.");
        }
        return user;
    }

    /**
     * Creates recurrent sessions based on the schedule
     * @param userId 
     * @param createSessionDto 
     * @param file 
     */
    private async createRecurrentSessions(userId: string, createSessionDto: CreateSessionDto, file?: S3FIle) {
        const recurrent_days = createSessionDto.days;
        const recurrent_ended_at = new Date(new Date(createSessionDto.end_date).setHours(23, 59, 59, 999));
        const session_template = this.buildSessionInstance(userId, createSessionDto, file);
        const formattedDays = recurrent_days.map((day: DAYS) => DAYS[day]) as ByWeekday[];

        const rrule = new RRule({
            freq: Frequency.WEEKLY,
            byweekday: formattedDays,
            dtstart: new Date(session_template.started_at),
            until: recurrent_ended_at
        });

        const dates = rrule.all();

        await this.prismaService.$transaction(async prisma => {
            for (const date of dates) {
                await prisma.session.create({
                    data: {
                        ...session_template,
                        started_at: date,
                        completed_at: new Date(date.getTime() + SESSION_CONSTANTS.SESSION_COMPLETE_AFTER_DAYS)
                    }
                });
            }
        });
    }

    /**
     * Creates a single session
     * @param userId 
     * @param createSessionDto 
     * @param file 
     * @returns Created session
     */
    private async createSingleSession(userId: string, createSessionDto: CreateSessionDto, file?: S3FIle) {
        const session = this.buildSessionInstance(userId, createSessionDto, file);
        const createdSession = await this.prismaService.session.create({ data: session });

        this.sessionNotifier.sendNotification(
            userId,
            Audience.USER,
            NotificationLevel.INFO,
            "Your sesssion live now!",
            `Session titled ${createdSession.title} has been created`,
        );

        return createdSession;
    }

    private buildSessionInstance(userId: string, createSessionDto: CreateSessionDto, file?: S3FIle) {

        try {
            const sessionBuilder = this.sessionBuilder

                .setCoach(userId)
                .setTitle(createSessionDto.title)
                .setDescription(createSessionDto.description)
                .setLocation({ lat: createSessionDto.location[0], long: createSessionDto.location[1] })
                .setEquipments(createSessionDto.equipments)
                .setObjectives(createSessionDto.objectives)
                .setFee(createSessionDto.fee)
                .setMaxParticipant(createSessionDto.max_participants)
                .setMinimumAge(createSessionDto.min_age)
                .setStartAt(createSessionDto.start_date, createSessionDto.start_time)
                .setBanner(file)
                .setAddress(createSessionDto.address)
                .setAdditionalNotes(createSessionDto.additional_notes)

            return sessionBuilder.build()
        } catch (err) {
            throw err
        }
    }


    /**
     * 
     * @param userId 
     * @param sessionQuery 
     * @returns 
     */
    async getSessions(userId: string, sessionQuery: SessionQueryDto) {
        const { skip } = this.getPaginationParams(sessionQuery);
        console.log("get_session_Service", sessionQuery)
        const [sessions] = await this.prismaService.$transaction(
            [this.prismaService.session.findMany({
                where: {
                    title: { contains: sessionQuery.query, mode: "insensitive" },
                    participants: {
                        none: {
                            player_id: userId, player_status: PlayerStatus.Attending, OR: [{ payment_status: ParticipantPaymentStatus.Paid }, {
                                payment_status: ParticipantPaymentStatus.Cash
                            }]
                        }
                    },
                    status: SessionStatus.CREATED
                },
                include: { _count: { select: { participants: { where: { player_status: PlayerStatus.Attending, payment_status: ParticipantPaymentStatus.Paid } } } } }
            })])

            console.log("sessions", sessions)

            if (sessionQuery.location){
                const filteredSessions = sessions.filter(session => {
                const sessionLocation = session.location;
                if (sessionLocation) {
                    const distance = this.getSessionDistance(
                        { latitude: sessionQuery.location[0], longitude: sessionQuery.location[1] },
                        { latitude: sessionLocation["coordinates"][0], longitude: sessionLocation["coordinates"][1] });

                    const radiusInMeter = sessionQuery.radius * MILES_TO_METERS;
                    return distance <= radiusInMeter;
                }
                return false;
                });
                        const slicedSessions = filteredSessions.slice(skip, skip + sessionQuery.limit);

        const mappedSessions = slicedSessions.map(session => {
            return { ...session, left: session.max_participants - session._count.participants };
        });

     

        return { sessions: mappedSessions, total: filteredSessions.length };
                
            }
            const mappedSessions = sessions.map(session => {
                return {...session, left:session.max_participants - session._count.participants}
            })

            return {sessions:mappedSessions, total: sessions.length}
       


    }

    private getSessionDistance(
        startPont: {
            latitude: number,
            longitude: number
        },
        targetPoint: {
            latitude: number,
            longitude: number
        }) {

        const distance = getDistance(startPont, targetPoint, 1)


        return distance
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

    async getCoachUpcomingSessions(coachId: string, pagination: PaginationDto) {
        const upcomingWindow = this.upcomingSessionWindow(UPCOMING_SESSIONS_WINDOW_DAYS);
        const { skip, take } = this.getPaginationParams(pagination);

        const [sessions, total] = await this.prismaService.$transaction([
            this.prismaService.session.findMany({
                where: { coach_id: coachId, started_at: upcomingWindow, status: SessionStatus.CREATED },
                orderBy: { started_at: "asc" },
                skip,
                take,
                include: {
                    _count: { select: { participants: { where: { player_status: PlayerStatus.Attending } } } }
                }
            }),
            this.prismaService.session.count({
                where: { coach_id: coachId, started_at: upcomingWindow, status: SessionStatus.CREATED }
            })
        ]);


        const sessionWithJoinDetails = await Promise.all(sessions.map(async session => {
            const joindParticipant = await this.prismaService.sessionParticipant.count({
                where: {
                    session_id: session.id, player_status: PlayerStatus.Attending
                }
            });
            return { ...session, left: session.max_participants - joindParticipant };
        }));

        return { sessions: sessionWithJoinDetails, total };
    }


    /**
     * A window from current day to windwLength 
     * 
     * @param windowLength 
     * @returns 
     */
    private upcomingSessionWindow(windowLength: number) {
        const currentDate = new Date(Date.now())
        const afterThreeDays = new Date(currentDate.getTime() + windowLength * 24 * 60 * 60 * 1000)

        return { gte: currentDate, lte: afterThreeDays }
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
    async getAvailableSessions(coachId: string, pagination: PaginationDto) {
        const { skip, take } = this.getPaginationParams(pagination);

        const [sessions, total] = await this.prismaService.$transaction([
            this.prismaService.session.findMany({
                where: { coach_id: coachId, participants: { none: { player_status: PlayerStatus.Attending, payment_status: ParticipantPaymentStatus.Paid } }, status: SessionStatus.CREATED },
                skip,
                take
            }),
            this.prismaService.session.count({
                where: { coach_id: coachId, participants: { none: { player_status: PlayerStatus.Attending, payment_status: ParticipantPaymentStatus.Paid } }, status: SessionStatus.CREATED }
            })
        ]);

        return { sessions, total };
    }


    /**
     * get coach active sessions
     * active sessions are where at least one player has enrolled
     * 
     * @param coachActiveSessionDto 
     * @param pagination 
     * @returns 
     */
    async getActiveSessions(coachId: string, pagination: PaginationDto) {
        const { skip, take } = this.getPaginationParams(pagination);

        const [sessions, total] = await this.prismaService.$transaction([
            this.prismaService.session.findMany({
                where: { coach_id: coachId, participants: { some: { player_status: PlayerStatus.Attending } }, status: SessionStatus.CREATED },
                skip,
                take,
                include: { _count: { select: { participants: { where: { player_status: PlayerStatus.Attending, payment_status: ParticipantPaymentStatus.Paid } } } } }
            }),
            this.prismaService.session.count({
                where: { coach_id: coachId, participants: { some: { player_status: PlayerStatus.Attending, payment_status: ParticipantPaymentStatus.Paid } }, status: SessionStatus.CREATED }
            })
        ]);

        const mappedActiveSession = sessions.map(session => {
            const { _count, ...sessionDetails } = session;
            return { ...sessionDetails, joined: _count.participants };
        });

        return { sessions: mappedActiveSession, total };
    }


    /**
     * update a session
     * @param sessionId
     * @returns 
     */

    async updateSession(userId: string, updateSessionDto: UpdateSessionDto, file?: Express.Multer.File) {
        const session = await this.prismaService.session.findUnique({ where: { id: updateSessionDto.sessionId } })

        if (!session) {
            throw new NotFoundException("session not found!")
        }

        if (session.coach_id !== userId) {
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
            updatedData.location = { type: "Point", coordinates: updateSessionDto.location }
        }

        if (file) {
            updatedData.banner = file.path
        }

        const updatedSession = await this.prismaService.session.update({ where: { id: session.id }, data: updatedData })


        // Notify participant that this session is updated


        return updatedSession

    }

    /**
     * 
     * @param userId 
     * @param cancelSessionDto 
     * @returns 
     */

    async cancelSession(userId: string, cancelSessionDto: CancelSessionDto) {

        const user = await this.prismaService.user.findUnique({ where: { id: userId } })

        if (!user) {
            throw new NotFoundException("user not found")
        }

        if (user.role === UserRole.COACH) {

            return await this.cancelSessionByCoach(user.id, cancelSessionDto)
        }

        if (user.role === UserRole.ADMIN) {

            return await this.cancelSessionByAdmin(userId, cancelSessionDto)
        }

        return await this.cancelEnrolledSessionByPlayer(user.id, cancelSessionDto)
    }

    /**
     * 
     * @param adminId 
     * @param sessionId 
     * @returns 
     */

    async cancelSessionByAdmin(adminId: string, cancelSessionDto: CancelSessionDto) {

        const session = await this.prismaService.session.findUnique({ where: { id: cancelSessionDto.sessionId }, include: { participants: true } })

        if (!session) {
            throw new NotFoundException("session not found")
        }

        if (session.status === SessionStatus.CREATED) {
            throw new BadRequestException("Session has started or completed. You can not cancel the session right now.")
        }

        return this.adminCancelStrategy.handleCancelRequest(adminId, session, session.participants, cancelSessionDto.note)

    }


    /**
     * 
     * @param userId 
     * 
     * @param cancelSessionDto 
     */
    async cancelSessionByCoach(userId: string, cancelSessionDto: CancelSessionDto) {

        const session = await this.prismaService.session.findFirst({ where: { id: cancelSessionDto.sessionId }, include: { participants: true } })

        if (!session) {
            throw new NotFoundException("session not found")
        }

        if (session.coach_id !== userId) {
            throw new UnauthorizedException("Sorry!, you are not allowed to delete this session.")
        }

        console.log(session)
        console.log(new Date(Date.now()))
        if (session.started_at <= new Date(Date.now())) {
            throw new BadRequestException("Sorry! This session can not be cancelled")
        }

        //invoke coach cancelStrategy to handle session cancellation request
        await this.coachCancelStrategy.handleCancelRequest(userId, session, session.participants, cancelSessionDto.note)

    }

    /**
     * 
     * @param userId 
     * @param cancelSessionDto 
     */

    async cancelEnrolledSessionByPlayer(userId: string, cancelSessionDto: CancelSessionDto) {

        const session = await this.prismaService.session.findFirst({
            where: { id: cancelSessionDto.sessionId },
            include: { participants: { where: { player_id: userId, player_status: PlayerStatus.Attending } } }
        })

        if (!session) {
            throw new NotFoundException("session not found")
        }

        if (session.participants.length <= 0) {
            throw new BadRequestException("Sorry! you are not enrolled yet.")
        }

        //invoke player cancelStrategy to handle session cancellation request
        await this.playerCancelStrategy.handleCancelRequest(userId, session, session.participants[0], cancelSessionDto.note)

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
    async enrollSession(playerId: string, enrollSessionDto: EnrollSessionDto) {
        const session = await this.prismaService.session.findUnique({ where: { id: enrollSessionDto.sessionId } });

        if (!session) {
            throw new NotFoundException("session not found!");
        }

        await this.validateEnrollment(playerId, enrollSessionDto.sessionId, session.participant_min_age);

        const platform_fee = await this.prismaService.platformFee.findFirst();

        if (session.fee <= 0 && (platform_fee && platform_fee.fee <= 0)) {
            return await this.enrollFreeSession(playerId, enrollSessionDto, session);
        }

        return await this.enrollPaidSession(playerId, enrollSessionDto, session);
    }

    /**
     * Validates if a player can enroll in a session
     * @param playerId 
     * @param sessionId 
     * @param minAge 
     */
    private async validateEnrollment(playerId: string, sessionId: string, minAge: number) {
        if (!(await this.isSessionValidToJoin(playerId, sessionId))) {
            throw new BadRequestException("session is not available to join");
        }

        if (await this.isPlayerAlreadyEnrolled(playerId, sessionId)) {
            throw new BadRequestException("you are already enrolled in this session");
        }

        if (!(await this.isPlayerAgeValidToJoin(playerId, minAge))) {
            throw new BadRequestException("Your age does not matched with the session requirement.");
        }
    }

    /**
     * Enrolls a player in a paid session
     * @param playerId 
     * @param enrollSessionDto 
     * @param session 
     * @returns 
     */
    private async enrollPaidSession(playerId: string, enrollSessionDto: EnrollSessionDto, session: any) {
        const result = await this.prismaService.$transaction(async prisma => {
            const sessionParticipant = await prisma.sessionParticipant.create({
                data: {
                    player_id: playerId,
                    session_id: enrollSessionDto.sessionId,
                    payment_method: enrollSessionDto.paymentMethod,
                    ...(enrollSessionDto.paymentMethod === PaymentMethod.CASH ? { payment_status: ParticipantPaymentStatus.Cash, player_status: PlayerStatus.Attending } : {})
                }
            });

            if (sessionParticipant.payment_method === PaymentMethod.ONLINE) {
                const paymentLink = await this.paymentService.createPayment({
                    item_id: sessionParticipant.session_id,
                    participant_id: sessionParticipant.id,
                    payment_type: PaymentType.Enrollment
                });
                return paymentLink;
            }

            return sessionParticipant;
        });

        return result;
    }

    /**
     * Enrolls a player in a free session
     * @param playerId 
     * @param enrollSessionDto 
     * @param session 
     * @returns 
     */
    private async enrollFreeSession(playerId: string, enrollSessionDto: EnrollSessionDto, session: any) {
        const participant = await this.prismaService.$transaction(async prisma => {
            const sessionParticipant = await prisma.sessionParticipant.create({
                data: {
                    player_id: playerId,
                    payment_method: enrollSessionDto.paymentMethod,
                    session_id: enrollSessionDto.sessionId,
                    player_status: PlayerStatus.Attending,
                    payment_status: ParticipantPaymentStatus.Paid
                }
            });
            return sessionParticipant;
        });

        this.notificationService.createNotification({
            audience: Audience.USER,
            userId: session.coach_id,
            title: "New Enrollment",
            message: `New player enrolled your session ${session.title}`,
            level: NotificationLevel.INFO
        });

        this.notificationService.createNotification({
            audience: Audience.USER,
            userId: playerId,
            title: "Enrollment successfull",
            message: `You enrolled new session ${session.title}`,
            level: NotificationLevel.INFO
        });

        return participant;
    }

    private async isPlayerAgeValidToJoin(playerId: string, requiredAge: number) {

        const player = await this.prismaService.user.findUnique({ where: { id: playerId } })
        if (player && player.dob) {
            const playerDOB = player.dob
            const age = this.calculateAge(playerDOB)
            return age >= requiredAge

        }

        return false
    }

    private calculateAge(dob: Date) {
        const currentDate = new Date(Date.now());
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        const birthYear = dob.getFullYear();
        const birthMonth = dob.getMonth() + 1;

        let age = currentYear - birthYear;

        // Subtract 1 if birthday hasn't occurred yet this year
        if (birthMonth > currentMonth) {
            age--;
        }

        return age;
    }


    /**
     * Players who are enrolled at any session of that coach.
     * Player payment status are completed or peding that means he will pay at the field.
     * @param getEnrolledPlayer 
     * @returns 
     */
    async getEnrolledPlayers(coachId: string, sessionId: string, paginationDto: PaginationDto) {
        const { skip, take } = this.getPaginationParams(paginationDto);

        if (!sessionId || sessionId.includes(":sessionId")) {
            throw new BadRequestException("session id is required");
        }

        const [enrolledPlayer, total] = await this.prismaService.$transaction([
            this.prismaService.sessionParticipant.findMany({
                where: { session: { coach_id: coachId, id: sessionId }, player_status: PlayerStatus.Attending },
                orderBy: { createdAt: "desc" },
                include: { player: true, session: true },
                skip,
                take
            }),
            this.prismaService.sessionParticipant.count({
                where: { session: { coach_id: coachId, id: sessionId }, player_status: PlayerStatus.Attending },
            })
        ]);

        return { players: enrolledPlayer, total };
    }

    async getEnrolledPlayersForAdmin(adminId: string, sessionId: string, paginationDto: PaginationDto) {
        const { skip, take } = this.getPaginationParams(paginationDto);

        if (!sessionId || sessionId.includes(":sessionId")) {
            throw new BadRequestException("session id is required");
        }

        const [enrolledPlayer, total] = await this.prismaService.$transaction([
            this.prismaService.sessionParticipant.findMany({
                where: { session: { id: sessionId }, player_status: PlayerStatus.Attending },
                orderBy: { createdAt: "desc" },
                include: { player: true, session: true },
                skip,
                take
            }),
            this.prismaService.sessionParticipant.count({
                where: { session: { id: sessionId }, player_status: PlayerStatus.Attending },
            })
        ]);

        return { players: enrolledPlayer, total };
    }


    /**
     * Players who are enrolled at any session of that coach
     * player payment status is cancelled
     * @param getCancelledPlayer 
     * @returns 
     */
    async getCancelledPlayer(coachId: string, sessionId: string, paginationDto: PaginationDto) {
        const { skip, take } = this.getPaginationParams(paginationDto);

        if (!sessionId || sessionId.includes(":sessionId")) {
            throw new BadRequestException("session id is required");
        }

        const [cancelledPlayers, total] = await this.prismaService.$transaction([
            this.prismaService.sessionParticipant.findMany({
                where: { session: { coach_id: coachId, id: sessionId }, player_status: PlayerStatus.Cancelled },
                orderBy: { createdAt: "desc" },
                include: { player: true, session: true },
                skip,
                take
            }),
            this.prismaService.sessionParticipant.count({
                where: { session: { coach_id: coachId, id: sessionId }, player_status: PlayerStatus.Cancelled },
            })
        ]);

        return { players: cancelledPlayers, total };
    }


    /**
     * 
     * @param sessionId 
     * @returns 
     */
    private async isSessionValidToJoin(playerId: string, sessionId: string) {

        const session = await this.prismaService.session.findUnique({

            where: { id: sessionId, status: SessionStatus.CREATED },
            include: {
                _count: {
                    select: {
                        participants: {
                            where: { player_status: PlayerStatus.Attending, payment_status: ParticipantPaymentStatus.Paid }
                        }
                    }
                }
            }
        })

        return session && session.coach_id !== playerId && session._count.participants < session.max_participants

    }

    /**
     * 
     * @param playerId 
     * @param sessionId 
     * @returns boolean
     */
    private async isPlayerAlreadyEnrolled(playerId: string, sessionId: string) {
        const participant = await this.prismaService.sessionParticipant.count({
            where: {
                player_id: playerId,
                session_id: sessionId,
                player_status: PlayerStatus.Attending,
                payment_status: ParticipantPaymentStatus.Paid
            }
        });
        return participant > 0;
    }

    /**
     * 
     * @param userId 
     * @param getPlayerSessionDto 
     * @returns 
     */

    async getPlayerEnrolledSessions(userId: string, getPlayerSessionDto: GetPlayerEnrolledSessionDto, pagination: PaginationDto) {
        const { skip, take } = this.getPaginationParams(pagination);

        if (getPlayerSessionDto.status === SessionStatus.COMPLETED) {

            const [enrolledSessions, total] = await this.prismaService.$transaction([
                this.prismaService.session.findMany({
                    where: {
                        participants: { some: { player_id: userId, player_status: PlayerStatus.Attending } },
                        OR: [{ status: SessionStatus.COMPLETED }, { status: SessionStatus.ONGOING }]
                    },
                    include: { coach: true },
                    skip,
                    take,
                    orderBy: { completed_at: "desc" }
                }),

                this.prismaService.session.count({
                    where: {
                        participants: { some: { player_id: userId, player_status: PlayerStatus.Attending } },
                        OR: [{ status: SessionStatus.COMPLETED }, { status: SessionStatus.ONGOING }]
                    },

                }),

            ])

            return { sessions: enrolledSessions, total }
        }

        if (getPlayerSessionDto.status === SessionStatus.ONGOING) {

            const [enrolledSessions, total] = await this.prismaService.$transaction([
                this.prismaService.session.findMany({
                    where: { participants: { some: { player_id: userId, player_status: PlayerStatus.Attending } }, status: SessionStatus.CREATED },
                    include: { coach: true },
                    skip,
                    take,
                    orderBy: { started_at: "desc" }
                }),

                this.prismaService.session.count({
                    where: { participants: { some: { player_id: userId, player_status: PlayerStatus.Attending } }, status: SessionStatus.CREATED },

                }),

            ])

            const playerSessions = await Promise.all(enrolledSessions.map(async session => {
                const room = await this.prismaService.chatRoom.findFirst({ where: { members: { every: { user_id: { in: [userId, session.coach_id] } } } } })
                if (room) {
                    Object.assign(session, { room_id: room.id })
                }

                return session
            }))

            return { sessions: playerSessions, total }

        } else if (getPlayerSessionDto.status === SessionStatus.CANCELLED) {

            const [enrolledSessions, total] = await this.prismaService.$transaction([
                this.prismaService.session.findMany({
                    where: { participants: { some: { player_id: userId, player_status: PlayerStatus.Cancelled } } },
                    include: { coach: true },
                    skip,
                    take,
                }),

                this.prismaService.session.count({
                    where: { participants: { some: { player_id: userId, player_status: PlayerStatus.Cancelled } } },
                }),

            ])

            return { sessions: enrolledSessions, total }
        }

        const [enrolledSessions, total] = await this.prismaService.$transaction([
            this.prismaService.session.findMany({
                where: { participants: { some: { player_id: userId, player_status: PlayerStatus.Attending } }, status: getPlayerSessionDto.status },
                include: { coach: true },
                skip,
                take,
            }),

            this.prismaService.session.count({
                where: {
                    participants: { some: { player_id: userId, player_status: PlayerStatus.Attending } },
                    status: getPlayerSessionDto.status
                },
            }),

        ])

        return { sessions: enrolledSessions, total }
    }


    async getSessionDetailsById(userId: string, sessionId: string) {

        const session = await this.prismaService.session.findUnique({ where: { id: sessionId }, include: { coach: true, participants: { where: { player_id: userId, player_status: PlayerStatus.Attending, OR: [{ payment_status: ParticipantPaymentStatus.Cash }, { payment_status: ParticipantPaymentStatus.Paid }] } } } })

        if (!session) {
            throw new NotFoundException("session not found")
        }

        const refundRequest = await this.prismaService.refundRequest.findFirst({
            where: {
                session_id: session.id,
                status: RefundRequestStatus.Pending,
                participant: { player_id: userId }
            }
        })
        let platform_fee = await this.prismaService.platformFee.findFirst()


        const room = await this.prismaService.chatRoom.findFirst({ where: { members: { every: { user_id: { in: [userId, session.coach_id] } } } } })

        if (room) {
            Object.assign(session, {
                room_id: room.id
            })
        }

        Object.assign(session, {
            refund_requested: Boolean(refundRequest),
            free_session: session.fee <= 0,
            platform_fee: platform_fee?.fee || 0.0
        })

        return session
    }

    async getAllSessions(query: SessionQueryDto) {
        const { skip, take } = this.getPaginationParams(query);

        const [sessions, total] = await Promise.all([
            this.prismaService.session.findMany({
                where: { coach: { fullName: { contains: query.query, mode: 'insensitive' } } },

                orderBy: { createdAt: "desc" },
                include: { _count: { select: { participants: { where: { player_status: PlayerStatus.Attending } } } }, coach: true },
                skip,
                take,
            }),
            this.prismaService.session.count()
        ])

        const mappedSessions = sessions.map(session => {
            const totalJoined = session._count.participants
            const is_cancelable = session.status === SessionStatus.CREATED

            return { ...session, is_cancelable, left: session.max_participants - totalJoined, joined: totalJoined }
        })



        return { sessions: mappedSessions, total }

    }

    async reportSession(userId: string, reportSessionDto: ReportSessioDto) {

        try {
            const participant = await this.prismaService.sessionParticipant.findFirst({
                where: {
                    session_id: reportSessionDto.sessionId, player_id: userId,
                    player_status: PlayerStatus.Attending
                }
            })

            if (!participant) {
                throw new BadRequestException("Sorry! You are not valid participant to report.")
            }

            const session = await this.prismaService.session.findFirst({
                where: {
                    id: reportSessionDto.sessionId,
                    status: SessionStatus.ONGOING
                }
            })

            if (!session) {
                throw new BadRequestException("Session does not exist")
            }

            const createdReport = await this.prismaService.report.create({
                data: {
                    description: reportSessionDto.description,
                    session_id: reportSessionDto.sessionId,
                    participant_id: participant.id,
                    need_refund: reportSessionDto.ask_refund
                }
            })

            if (createdReport.need_refund && participant.payment_status === ParticipantPaymentStatus.Cash) {
                throw new BadRequestException("Cash payment is not refundable")
            }

            if ((session.fee > 0 && participant.payment_status === ParticipantPaymentStatus.Paid) && createdReport.need_refund) {
                await this.refundRequestResolver.resolveRefundRequest(createdReport.participant_id, session, createdReport.description)
            }

        } catch (err) {
            throw new BadRequestException(err.message)
        }

    }

    // async getRecurringSessions(userId:string, pagination:PaginationDto){

    //     const skip = (pagination.page - 1) * pagination.limit

    //     const reSessions = await this.prismaService.sessionTemplate.findMany({
    //         where:{coach_id:userId}, 
    //         include:{recurringData:true},
    //         skip,
    //         take:pagination.limit
    //     })
    //     const total = await this.prismaService.sessionTemplate.count({where:{coach_id:userId}})

    //     return {reSessions, total}
    // }


    async warnCoach(warnCoachDto: WarnCoachDto) {

        const session = await this.prismaService.session.findUnique({ where: { id: warnCoachDto.session_id } })

        if (!session) {
            throw new NotFoundException("Session not found")
        }

        await this.notificationService.createNotification({
            userId: session.coach_id,
            audience: Audience.USER,
            level: NotificationLevel.WARNING,
            title: `You got warning for session "${session.title}"`,
            message: warnCoachDto.note
        })
    }



}