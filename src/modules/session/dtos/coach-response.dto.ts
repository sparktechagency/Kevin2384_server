import { Expose, Transform } from "class-transformer"

export class CoachResponseDto {

    @Expose()
    id:string

    @Expose()
    @Transform(obj => {
                
        if(obj.value){
            let value = obj.value as string
            value =  value.replaceAll("\\", "\/")
                return `${value}`
        }
    })
    avatar:string

    @Expose()
    fullName:string
    
    @Expose()
    sport:string
}