import { BadRequestException, Injectable } from "@nestjs/common";
import { LocationCords, Session } from "../models/Session.model";


export class SessionBuilder{

    private readonly session:Session
   
    constructor(){
        this.session = new Session()
    
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

    setBanner(bannerUrl?:Express.Multer.File){

        if(bannerUrl){
            this.session.banner = bannerUrl.path
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


    /**
   * @deprecated Use setDateTime() instead.
   */
    setStartDate(datetime:string){
        const covertedDate = new Date(datetime)
        const currentDate = new Date(Date.now())

        if(covertedDate <= currentDate){
            
        }
        this.session.started_at = new Date(datetime)

        return this

    }

    setStartTime(date:string, time:string){

        const [hours, minutes] = this.getTimeParts(time)
        const startedDate = new Date(date).setUTCHours(hours + this.getTimeZoneOffset() , minutes + this.getTimeZoneOffset())

        this.session.started_at = new Date(startedDate)
        
        // set completed time after 24 hour from start 
        this.session.completed_at = new Date(startedDate + 24 * 60 * 60 * 1000)

        return this
    }



    private getTimeParts(time:string){
        const [splittedTime, ampm] = time.split(" ")
        return splittedTime.split(":").map(part => Number(part))
    }

    private getTimeZoneOffset(){
        return new Date().getTimezoneOffset()
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

        this.session.fee = fee

        return this
    }

    build(){

        return this.session
    }

  
    

}