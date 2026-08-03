import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { V12AuthService } from './v12-auth.service';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      // Stabilization: never ship production with hardcoded JWT secret
      secret:
        process.env.JWT_SECRET ||
        (process.env.NODE_ENV === 'production'
          ? (() => {
              throw new Error('JWT_SECRET is required in production');
            })()
          : 'zrh-ai-dev-secret'),
    }),
    forwardRef(() => MailModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, V12AuthService],
  exports: [AuthService, V12AuthService],
})
export class AuthModule {}
