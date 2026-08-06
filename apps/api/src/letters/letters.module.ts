import { Module } from "@nestjs/common";
import { LettersService } from "./letters.service";
import { LettersController } from "./letters.controller";
import { PdfService } from "./pdf.service";

@Module({
  controllers: [LettersController],
  providers: [LettersService, PdfService],
})
export class LettersModule {}
