import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { FaqService } from './faq.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole } from 'src/common/enums/user/role.enum';

@ApiTags('FAQ')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Post('/add')
  @Roles(UserRole.SUPERADMIN)
  createFaq(@Body() dto: CreateFaqDto) {
    return this.faqService.createFaq(dto);
  }

  @Get('/')
  @Roles(UserRole.PASSENGER, UserRole.DRIVER, UserRole.SUPERADMIN)
  getFaqs() {
    return this.faqService.getFaqs();
  }

  @Patch('/:id')
  @Roles(UserRole.SUPERADMIN)
  updateFaq(@Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.faqService.updateFaq(id, dto);
  }

  @Delete('/:id')
  @Roles(UserRole.SUPERADMIN)
  deleteFaq(@Param('id') id: string) {
    return this.faqService.deleteFaq(id);
  }
}
