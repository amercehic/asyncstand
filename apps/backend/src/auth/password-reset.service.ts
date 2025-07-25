import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { hash } from '@node-rs/argon2';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit-log.service';

@Injectable()
export class PasswordResetService {
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.logger.setContext(PasswordResetService.name);
    // Initialize transporter
    this.setupTransporter().catch((error) => {
      this.logger.error('Failed to setup email transporter', { error });
    });
  }

  private async setupTransporter() {
    if (process.env.NODE_ENV === 'production') {
      // In production, use SendGrid or other email service
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // In development, use ethereal.email for testing
      // Create the test account once during initialization
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.logger.info('Ethereal test account created', {
          user: testAccount.user,
          previewUrl: `https://ethereal.email/create?email=${testAccount.user}`,
        });
      } catch (error) {
        this.logger.error('Failed to create ethereal test account', { error });
        this.transporter = null;
      }
    }
  }

  async createPasswordResetToken(email: string, ipAddress: string): Promise<void> {
    const startTime = Date.now();

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        orgMembers: {
          where: { status: 'active' },
          select: {
            org: {
              select: { id: true, name: true },
            },
          },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new ApiError(
        ErrorCode.USER_NOT_FOUND,
        'User with this email does not exist',
        HttpStatus.NOT_FOUND,
      );
    }

    // Generate a secure random token (64 bytes = 512 bits)
    const token = randomBytes(64).toString('hex');

    // Set expiration to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Get user's primary organization for audit logging
    const primaryOrg = user.orgMembers[0]?.org;

    // Store the token in the database
    await this.prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // Create audit log (synchronous - important for security)
    await this.auditLogService.log({
      action: 'password.reset.requested',
      actorUserId: user.id,
      orgId: primaryOrg?.id,
      payload: {
        userId: user.id,
        email: user.email,
        ipAddress,
        tokenExpiresAt: expiresAt,
      },
    });

    // Send password reset email (non-blocking)
    this.sendPasswordResetEmail(user.email, token, user.name).catch((error) => {
      this.logger.logError(error as Error, { email: user.email, context: 'password reset email' });
    });

    const totalTime = Date.now() - startTime;
    this.logger.info('Password reset token created', {
      email,
      totalTime: `${totalTime}ms`,
    });
  }

  async resetPassword(
    token: string,
    newPassword: string,
    email: string,
    ipAddress: string,
  ): Promise<void> {
    // Find the password reset token
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            orgMembers: {
              where: { status: 'active' },
              include: { org: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!resetToken) {
      throw new ApiError(
        ErrorCode.TOKEN_ALREADY_USED,
        'Invalid or expired reset token',
        HttpStatus.GONE,
      );
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      // Delete expired token
      await this.prisma.passwordResetToken.delete({
        where: { token },
      });

      throw new ApiError(
        ErrorCode.TOKEN_EXPIRED,
        'Password reset token has expired',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify email matches
    if (resetToken.user.email !== email) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Email does not match the reset token',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Hash the new password
    const passwordHash = await hash(newPassword, {
      memoryCost: 1 << 14, // 16 MiB
      timeCost: 3,
    });

    // Update user password and delete the token in a transaction
    const primaryOrg = resetToken.user.orgMembers[0]?.org;

    await this.prisma.$transaction(async (tx) => {
      // Update user password
      await tx.user.update({
        where: { id: resetToken.user.id },
        data: { passwordHash },
      });

      // Delete the used token
      await tx.passwordResetToken.delete({
        where: { token },
      });

      // Log the password reset completion
      if (primaryOrg) {
        await tx.auditLog.create({
          data: {
            orgId: primaryOrg.id,
            actorUserId: resetToken.user.id,
            action: 'password.reset.completed',
            payload: {
              userId: resetToken.user.id,
              email: resetToken.user.email,
              ipAddress,
              resetAt: new Date(),
            },
          },
        });
      }
    });
  }

  private async sendPasswordResetEmail(
    email: string,
    token: string,
    userName?: string,
  ): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; }
          .footer { margin-top: 30px; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Password Reset Request</h1>
          <p>Hello ${userName || 'there'},</p>
          <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
          <p>To reset your password, click the button below:</p>
          <p><a href="${resetUrl}" class="button">Reset Password</a></p>
          <p>This link will expire in 24 hours for security reasons.</p>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; font-size: 12px; color: #666;">${resetUrl}</p>
          <div class="footer">
            <p>Best regards,<br>The AsyncStand Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@asyncstand.com',
      to: email,
      subject: 'Password Reset Request - AsyncStand',
      html,
    };

    try {
      if (this.transporter) {
        const info = await this.transporter.sendMail(mailOptions);

        if (process.env.NODE_ENV !== 'production') {
          this.logger.info('Password reset email sent', {
            email,
            previewUrl: nodemailer.getTestMessageUrl(info),
          });
        }
      } else {
        this.logger.warn('Email transporter not available', { email });
      }
    } catch (error) {
      this.logger.logError(error as Error, { email });
      // Don't throw error to avoid revealing if user exists
    }
  }
}
