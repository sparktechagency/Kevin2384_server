import { SessionType } from "generated/prisma/enums"


export type LocationCords  = {

    lat:number
    long:number
}

export class Session{

    coach_id:string

    title:string

    description:string

    banner:string

    fee:number

    location:{type:string, coordinates:number[]}

    address:string

    participant_min_age:number

    max_participants:number

    objectives:Array<string>

    equipments:Array<string>

    additional_notes:string

    started_at:Date
    
    completed_at:Date

    type: SessionType


}

