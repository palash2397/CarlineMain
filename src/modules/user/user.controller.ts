import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  UseInterceptors,
  UploadedFile,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { multerConfig } from 'src/common/middlewares/multer';
import { FileInterceptor } from '@nestjs/platform-express';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from 'src/modules/auth/roles/roles.decorator';

import { UserService } from './user.service';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('/Profile')
  getMyProfile(@Req() req: any) {
    // console.log(req.user);
    return this.userService.myProfile(req.user.id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Patch('/profile')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateProfileDto })
  @UseInterceptors(FileInterceptor('avatar', multerConfig('profile')))
  updateProfile(
    @Req() req: any,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // console.log('dto ----------->', dto);
    // console.log('file ----------->', file);
    return this.userService.updateProfile(req.user.id, dto, file);
  }

  @Post('/forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.userService.forgotPassword(dto);
  }

  @Patch('/reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.userService.resetPassword(dto);
  }

  // ==========================================================
  // Saved Places
  // ==========================================================
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('/address')
  @ApiOperation({ summary: 'List the places saved on the Saved Places screen' })
  getAddresses(@Req() req: any) {
    return this.userService.addresses(req.user.id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('/address')
  @ApiOperation({ summary: 'Save a new place (Add Saved Place)' })
  createAddress(@Req() req: any, @Body() dto: CreateAddressDto) {
    return this.userService.createAddress(req.user.id, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Patch('/address/:id')
  @ApiOperation({ summary: 'Edit a saved place' })
  @ApiParam({ name: 'id', example: '6ab26f40425392e9b18d4972' })
  updateAddress(
    @Req() req: any,
    @Param('id') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.userService.updateAddress(req.user.id, addressId, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Delete('/address/:id')
  @ApiOperation({ summary: 'Delete a saved place' })
  @ApiParam({ name: 'id', example: '6ab26f40425392e9b18d4972' })
  deleteAddress(@Req() req: any, @Param('id') addressId: string) {
    return this.userService.deleteAddress(req.user.id, addressId);
  }
}
