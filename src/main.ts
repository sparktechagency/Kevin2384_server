import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import  {GlobalHttpExceptionHandler}  from './common/exceptions/GlobalHttpExceptionHandler';
import { ResponseTransformerInterceptor } from './common/interceptors/responseTransformer.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import fs from 'fs'



async function bootstrap() {

  const httpsOptions = {
    key: fs.readFileSync('./private.key'),
  cert: fs.readFileSync('./certificate.pem'),
};

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger:["debug", "error", "warn", "fatal","verbose", "log"],
    rawBody:true
  });


  app.setGlobalPrefix("/api/v1", {
    exclude:["/"]
  })

  app.enableCors({
    origin:"*"
  })

//   app.useGlobalInterceptors(
//     new ClassSerializerInterceptor(app.get(Reflector), {
//       strategy: 'excludeAll',
//     }),
// );

  const staticFilePath = join(process.cwd(), 'uploads')

  app.useStaticAssets(staticFilePath, {prefix:'/uploads'})


  app.useGlobalPipes(new ValidationPipe({
    transform:true,
    whitelist:true,
    forbidNonWhitelisted:true
  }))

  app.useGlobalFilters(new GlobalHttpExceptionHandler())

  const reflector = app.get(Reflector)

  app.useGlobalInterceptors(new ResponseTransformerInterceptor(reflector))

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
