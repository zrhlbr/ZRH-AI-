import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { V12AuthService } from './v12-auth.service';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'zrh-ai-dev-secret',
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, V12AuthService],
  exports: [AuthService, V12AuthService],
})
export class AuthModule {}
