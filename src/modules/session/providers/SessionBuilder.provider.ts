import { BadRequestException, Injectable } from "@nestjs/common";
import { LocationCords, Session } from "../models/Session.model";
import { SessionType } from "generated/prisma/enums";
import type { S3FIle } from "src/common/types/S3File.type";


export class SessionBuilder{

    private readonly session:Session
   
    constructor(){
        this.session = new Session()
    
       }

    setType (type?:SessionType){
        if(type)
            this.session.type = type
        else 
            this.session.type = SessionType.Paid

        return this
    }

    setCoach(coachId:string){
        this.session.coach_id = coachId

        return this
    }

    setTitle(title:string){
        this.session.title = String(title).trim()

        return this
    }

    setDescription(description:string){
        this.session.description = String(description).trim()

        return this
    }

    setMaxParticipant(value:number){
        if(value <= 0){
            throw new Error("invalid argument. Max participant must be 1 or more")
        }

        this.session.max_participants = value

        return this
    }

    setBanner(bannerUrl?:S3FIle){

        if(bannerUrl){
            this.session.banner = bannerUrl.location
        }

        return this
    }

    setLocation(cords:LocationCords){
        this.session.location  = {type:"Point", coordinates:[cords.lat, cords.long]}
       
        return this
    }

    setAddress(address:string){
        this.session.address = address

        return this
    }

    setAdditionalNotes(notes?:string){

        if(notes)
            this.session.additional_notes = notes

        return this
    }


   
    private setStartDate(datetime:Date){
        const startDate = new Date(datetime)
        const currentDate = new Date(Date.now())
        const utcdate = this.getUtcDate(currentDate.toLocaleDateString(), currentDate.toLocaleTimeString())

        if(startDate <= utcdate){
            throw new Error("Error occured during setting start time. Start date must be in future.")
        }
        this.session.started_at = startDate

    }

    private setCompletedAt(date:Date){
      
        this.session.completed_at = date
    }

    setStartAt(date:string, time:string){

        const startDate = this.getUtcDate(date,time)
        const completedDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
     
        this.setStartDate(new Date(startDate))
        
        // set completed time after 24 hour from start 
       this.setCompletedAt(completedDate)

        return this
    }


    private getUtcDate(date:string, time:string):Date{

        const [hours, minutes] = this.getTimeParts(time)
        const [m,d,y] = this.getDateParts(date)
    
        return  new Date(Date.UTC(y,m-1,d,hours,minutes))

    }

    private getTimeParts(time:string){
        const [splittedTime, ampm] = time.split(" ")
        let [hour, minutes] = splittedTime.split(":").map(part => Number(part))
        if((ampm == "PM") && (hour < 12))
           hour = Math.min( hour += 12, 23)
        return [hour, minutes]
    }

    private getDateParts(date:string){
        return date.split("/").map(part => Number(part))
    }

    
    setMinimumAge(age:number){
        if(age <= 0){
            throw new Error("Invalid age")
        }

        this.session.participant_min_age = age

        return this
    }

    setObjectives(objecives:Array<string>){
        if(objecives.length <= 0){
            throw new Error("Invalid session objectives. Must add at least one objectives")
        }

        this.session.objectives = objecives

        return this
    }

    setEquipments(equipments:Array<string>){

        this.session.equipments = equipments

        return this
    }
    
    setFee(fee:number){
        if(fee < 0){
            throw new Error("invalid fee. Fee must be 0 or more")
        }

        if(fee == 0 ){
            this.setType(SessionType.Free)
        }else {
            this.setType(SessionType.Paid)
        }

        this.session.fee = fee

        return this
    }

    build(){

        return this.session
    }

  
    

}