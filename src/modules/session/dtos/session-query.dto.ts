import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { PaginationDto } from "src/common/dtos/pagination.dto";

export class SessionQueryDto extends PaginationDto {

    @IsOptional()
    @IsString()
    query:string

    @ArrayMinSize(2)
    @ArrayMaxSize(2)
    @IsNumber({}, {each:true})
    @IsOptional()
    @IsNotEmpty()
    @Transform(obj => {
    
        if(obj.value)
            return obj.value.split(",").map((item:string) => Number(item))
    })
    location:number[]


    @Min(0)
    @IsNotEmpty()
    @IsOptional()
    @Transform((obj) => {
        if(obj.value){
            return Number(obj.value)
        }
    })
    radius:number

}