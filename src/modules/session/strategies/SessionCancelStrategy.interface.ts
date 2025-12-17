import { Session, SessionParticipant } from "generated/prisma/client";
import { CancelSessionDto } from "../dtos/cancel-session.dto";

export interface SessionCancelStrategy {
    handleCancelRequest(userId:string, session:Session, participants: SessionParticipant | SessionParticipant[], reason:string):Promise<void>

}