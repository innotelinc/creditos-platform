import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { TenantsService } from "../tenants/tenants.service";
import { Permissions } from "../common/decorators";

@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin")
export class AdminController {
  constructor(private readonly tenants: TenantsService) {}

  @Get("tenants")
  @Permissions("superAdmin")
  @ApiOperation({ summary: "All tenants (super admin)" })
  listTenants() {
    return this.tenants.allTenants();
  }

  @Get("stats")
  @Permissions("adminAll")
  @ApiOperation({ summary: "Global platform stats" })
  stats() {
    return this.tenants.globalStats();
  }
}
