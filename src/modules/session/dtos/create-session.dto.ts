import { Expose, Transform, Type } from "class-transformer"
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator"
import { SessionType } from "generated/prisma/enums"
import { DAYS } from "../enums/days"

export class CreateSessionDto {

    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @Expose()
    start_date:string

    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @Expose()
    start_time:string

    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @Expose()
    title:string


    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @Expose()
    description:string


    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @Expose()
    address:string


    @IsArray()
    @ArrayMinSize(2)
    @ArrayMaxSize(2)
    @IsNumber({}, {each:true})
    @Type(() => Number)
    @Expose()
    location:Array<number>


    @IsInt()
    @IsNotEmpty()
    @Type(() => Number)
    @Expose()
    min_age:number


    @IsInt()
    @IsNotEmpty()
    @Type(() => Number)
    @Expose()
    max_participants:number


    // @IsNumber()
    // @Type(() => Number)
    // @Expose()
    // duration:number


    @IsNumber()
    @Type(() => Number)
    @Min(0)
    @Expose()
    fee:number
    

    @IsArray()
    @IsString({each:true})
    @ArrayMinSize(1)
    @Expose()
    objectives:Array<string>

    
    @IsArray()
    @IsString({each:true})
    @IsOptional()
    @Type(() => Array<string>)
    @Expose()
    equipments:Array<string>

   
    @IsOptional()
    @Expose()
    additional_notes:string

    @Transform((obj) => {
        return obj.value && obj.value === "true"
    })
    @IsBoolean()
    @IsNotEmpty()
    is_recurrent:boolean

    @IsArray()
    @IsEnum(DAYS, {
        each:true
    })
    @Transform(obj => {
        if(Array.isArray(obj.value)){
            return obj.value
        }

        if(typeof obj.value  === 'string'){
            let day = obj.value as string
            let arrayOfDay:string[] = []
            arrayOfDay.push(day.trim())
            return arrayOfDay
        }
        
        return obj.value
        
    })
    @IsOptional()
    days:DAYS[]

    @IsString()
    @IsNotEmpty()
    @IsOptional()
    end_date:Date

}