import { Exclude, Expose, Type } from "class-transformer"
import { ValidateNested } from "class-validator"
import { SessionResponseDto } from "./session-response.dto"



export class CoachUpcomingSessionResponseDto{

    @Expose()
    @ValidateNested()
    @Type(() => SessionResponseDto)
    sessions:SessionResponseDto[]

    @Expose()
    total:number
}

