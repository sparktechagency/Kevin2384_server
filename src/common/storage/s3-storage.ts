import { S3Client } from "@aws-sdk/client-s3";
import { Inject, Injectable, Scope } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import awsConfig, { awsConfigData } from "src/config/aws.config";
import multerS3 from 'multer-s3'
import multer from "multer";

@Injectable({
    scope:Scope.REQUEST
})
export class S3Storage{
    private readonly s3Client:S3Client
    constructor(@Inject(awsConfig.KEY) private readonly awsCOnfigData:ConfigType<typeof awsConfigData>){
        try{
            this.s3Client = new S3Client([{
                region:this.awsCOnfigData.region,
                credentials:{
                    accessKeyId:this.awsCOnfigData.access_key,
                    secretAccessKey:this.awsCOnfigData.secret_key
                }
            }])
        }catch(err){
            console.log("Error:COnfiguring s3 client failed!", err)
            throw err
        }
    }

    public getStorage():multer.StorageEngine{

        console.log("Storage engine called")

        const multerStorage:multer.StorageEngine = multerS3({
            s3:this.s3Client,
            bucket:this.awsCOnfigData.bucket_name as string,
            metadata: function (req, file:Express.Multer.File, cb:(error:any, metadata?:any)=> void) {
                cb(null, {fieldName: file.fieldname});
            },
            key: function (req, file:Express.Multer.File, cb:any) {
                cb(null, Date.now().toString())
            }
        })
        return multerStorage
    }
}
