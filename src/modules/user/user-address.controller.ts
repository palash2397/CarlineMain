import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';

import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UserAddressService } from './user-address.service';

@ApiTags('User Address (by Prakash)')
@Controller('user/address')
export class UserAddressController {
  constructor(private readonly userAddressService: UserAddressService) {}

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List the places saved on the Saved Places screen' })
  getAddresses(@Req() req: any) {
    return this.userAddressService.addresses(req.user.id);
  }

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Save a new place (Add Saved Place)' })
  createAddress(@Req() req: any, @Body() dto: CreateAddressDto) {
    return this.userAddressService.createAddress(req.user.id, dto);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Edit a saved place' })
  @ApiParam({ name: 'id', example: '6ab276cb9f80ba504ce39c39' })
  updateAddress(
    @Req() req: any,
    @Param('id') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.userAddressService.updateAddress(req.user.id, addressId, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a saved place' })
  @ApiParam({ name: 'id', example: '6ab276cb9f80ba504ce39c39' })
  deleteAddress(@Req() req: any, @Param('id') addressId: string) {
    return this.userAddressService.deleteAddress(req.user.id, addressId);
  }
}
