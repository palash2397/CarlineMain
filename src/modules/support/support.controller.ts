import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { SupportService } from './support.service';
import { CreateSupportDto } from './dto/create-support.dto';
import { UpdateSupportDto } from './dto/update-support.dto';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole } from 'src/common/enums/user/role.enum';

@ApiTags('Support')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('/add')
  @Roles(UserRole.PASSENGER)
  createTicket(@Req() req: any, @Body() dto: CreateSupportDto) {
    return this.supportService.createTicket(req.user.id, dto);
  }

  // @Get('/my')
  // @Roles(UserRole.PASSENGER)
  // getMyTickets(@Req() req: any) {
  //   return this.supportService.getMyTickets(req.user.id);
  // }

  @Get('/all')
  @Roles(UserRole.SUPERADMIN)
  getAllTickets() {
    return this.supportService.getAllTickets();
  }

  @Patch('/:id')
  @Roles(UserRole.SUPERADMIN)
  updateTicketStatus(@Param('id') id: string, @Body() dto: UpdateSupportDto) {
    return this.supportService.updateTicketStatus(id, dto);
  }
}
