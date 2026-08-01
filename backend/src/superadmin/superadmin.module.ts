import { Module } from '@nestjs/common';
import { SystemModule } from '../system/system.module';
import { SuperAdminController } from './superadmin.controller';
import { SuperAdminService } from './superadmin.service';

@Module({
  imports: [SystemModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
})
export class SuperAdminModule {}
