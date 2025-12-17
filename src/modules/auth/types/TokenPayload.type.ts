import { UserRole } from "generated/prisma/enums"

export type TokenPayload = {
    id:string
    role:UserRole,
    email:string
    email_verified:boolean
}