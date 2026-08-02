import { Module } from '@nestjs/common';
import { SuperAdminModule } from '../superadmin/superadmin.module';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

@Module({
  imports: [SuperAdminModule],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
