import { Expose, Type } from "class-transformer"
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator"
import { SessionType } from "generated/prisma/enums"

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

    @IsEnum(SessionType)
    @IsNotEmpty()
    @IsString()
    @IsOptional()
    type:string

}