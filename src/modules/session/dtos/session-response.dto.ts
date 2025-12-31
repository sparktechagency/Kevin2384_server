import { Expose, Transform, Type } from "class-transformer"
import { CoachResponseDto } from "./coach-response.dto"
import { ValidateNested } from "class-validator"
import { SessionStatus, SessionType } from "generated/prisma/enums"
import { group } from "console"



export class SessionResponseDto {

    @Expose({
        groups:["public", "short", "admin"]
    })
    id:string

    @Expose({
        groups:["public", "short"]
    })
    @Transform(obj => {
            
        if(obj.value){
            let value = obj.value as string
            value =  value.replaceAll("\\", "\/")
                return `${value}`
        }
    })
    banner:string

    @Expose({
        groups:["public", "short", "admin"]
    })
    started_at:string


    @Expose({groups:["public", "short", "admin"]})
    title:string

    @Expose({groups:["public", "short", "admin"]})
    fee:number

    @Expose({groups:["coach", "public", "short"]})
    left:number

    @Expose({groups:["coach", "admin"]})
    joined:number

    @Expose({groups:["enrolled", "coach", "admin"]})
    address:string

    @Expose({groups:["enrolled", "public", "admin"]})
    @ValidateNested()
    @Type(() => CoachResponseDto)
    coach:CoachResponseDto

    @Expose({groups:["public", 'admin']})
    max_participants:number

    @Expose({groups:["public"]})
    objectives:string[]

    @Expose({groups:["public"]})
    equipments:string[]

    @Expose({groups:["public", "short"]})
    description:string

    @Expose({groups:["public"]})
    participant_min_age:number

    @Expose({
        groups:["public"]
    })
    additional_notes:string

    @Expose({
        groups:["admin"]
    })
    type:SessionType

    @Expose({
        groups:["extra"]
    })
    enrolled:boolean

    @Expose({
        groups:["extra"]
    })
    
    status:SessionStatus

    @Expose({
        groups:["extra"]
    })
    report_till:Date

    @Expose({
        groups:["extra"]
    })
    report_valid:boolean

    @Expose({
        groups:["extra"]
    })
    refund_requested:boolean

    @Expose({
        groups:["extra"]
    })
    free_session:boolean

    @Expose({
        groups:['room', "enrolled"]
    })
    room_id:string

    @Expose({
        groups:['admin']
    })
    is_cancelable:boolean
    @Expose({
        groups:["public"]
    })
    platform_fee:number
 
}