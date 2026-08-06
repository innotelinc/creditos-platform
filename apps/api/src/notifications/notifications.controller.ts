import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { CurrentUser } from "../common/decorators";
import { AuthUser } from "../common/types";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "My notifications" })
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.listForUser(user.id);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Unread notification count" })
  async unreadCount(@CurrentUser() user: AuthUser) {
    const { unread } = await this.notifications.listForUser(user.id, 1);
    return { unread };
  }

  @Post("read-all")
  @ApiOperation({ summary: "Mark all as read" })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(":id/read")
  @ApiOperation({ summary: "Mark one notification as read" })
  markRead(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.notifications.markRead(user.id, id);
  }
}
