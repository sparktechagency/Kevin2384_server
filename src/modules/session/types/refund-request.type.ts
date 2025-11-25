import { RefundRequestStatus } from "generated/prisma/enums"

export type RefundRequest = {
    participant_id:string,
    session_id:string
    status:RefundRequestStatus
}