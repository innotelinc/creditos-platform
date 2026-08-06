import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { MailService } from "../notifications/mail.service";
import { Public } from "../common/decorators";

class ContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;
  @IsEmail()
  email: string;
  @IsString()
  @MaxLength(120)
  subject: string;
  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  message: string;
}

@ApiTags("contact")
@Controller("contact")
export class ContactController {
  constructor(private readonly mail: MailService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Send a message from the public contact form" })
  async send(@Body() dto: ContactDto) {
    const to = process.env.CONTACT_EMAIL ?? "hello@creditos.local";
    await this.mail.send(
      to,
      `[Contact] ${dto.subject}`,
      `<p><strong>${dto.name}</strong> &lt;${dto.email}&gt;</p><p>${dto.message.replace(/\n/g, "<br/>")}</p>`,
    );
    return { success: true, message: "Message sent — we'll get back to you shortly." };
  }
}
