import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { hash } from '@node-rs/argon2';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';
import mjml from 'mjml';

@Injectable()
export class PasswordResetService {
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    // Initialize transporter
    this.setupTransporter();
  }

  private setupTransporter() {
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
      // We'll create the test account when needed
      this.transporter = null;
    }
  }

  async createPasswordResetToken(email: string, ipAddress: string): Promise<void> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        orgMembers: {
          where: { status: 'active' },
          include: { org: true },
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

    // Store the token in the database
    try {
      await this.prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt,
        },
      });
    } catch (error) {
      throw error;
    }

    // Get user's primary organization for audit logging
    const primaryOrg = user.orgMembers[0]?.org;

    // Log the password reset request
    if (primaryOrg) {
      try {
        await this.prisma.auditLog.create({
          data: {
            orgId: primaryOrg.id,
            actorUserId: user.id,
            action: 'password.reset.requested',
            payload: {
              userId: user.id,
              email: user.email,
              ipAddress,
              tokenExpiresAt: expiresAt,
            },
          },
        });
      } catch (error) {
        console.error('Failed to create audit log:', error);
        // Don't fail the password reset if audit logging fails
      }
    }

    // Send password reset email
    await this.sendPasswordResetEmail(user.email, token, user.name);
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

    const mjmlTemplate = `
      <mjml>
        <mj-head>
          <mj-title>Password Reset Request</mj-title>
          <mj-font name="Roboto" href="https://fonts.googleapis.com/css?family=Roboto" />
          <mj-attributes>
            <mj-all font-family="Roboto, Arial, sans-serif" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#ffffff" padding="20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="bold" color="#333333" align="center">
                Password Reset Request
              </mj-text>
              
              <mj-text font-size="16px" color="#666666" line-height="24px">
                Hello ${userName || 'there'},
              </mj-text>
              
              <mj-text font-size="16px" color="#666666" line-height="24px">
                We received a request to reset your password. If you didn't make this request, you can safely ignore this email.
              </mj-text>
              
              <mj-text font-size="16px" color="#666666" line-height="24px">
                To reset your password, click the button below:
              </mj-text>
              
              <mj-button background-color="#007bff" color="white" href="${resetUrl}" font-size="16px" padding="12px 24px">
                Reset Password
              </mj-button>
              
              <mj-text font-size="14px" color="#999999" line-height="20px">
                This link will expire in 24 hours for security reasons.
              </mj-text>
              
              <mj-text font-size="14px" color="#999999" line-height="20px">
                If the button doesn't work, you can copy and paste this link into your browser:
              </mj-text>
              
              <mj-text font-size="12px" color="#999999" word-break="break-all">
                ${resetUrl}
              </mj-text>
              
              <mj-text font-size="14px" color="#999999" line-height="20px">
                Best regards,<br/>
                The AsyncStand Team
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;

    const { html } = mjml(mjmlTemplate);

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@asyncstand.com',
      to: email,
      subject: 'Password Reset Request - AsyncStand',
      html,
    };

    try {
      // Setup transporter if not already done (for development)
      if (!this.transporter && process.env.NODE_ENV !== 'production') {
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
      }

      if (this.transporter) {
        const info = await this.transporter.sendMail(mailOptions);

        if (process.env.NODE_ENV !== 'production') {
          console.log('Password reset email sent to:', email);
          console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
        }
      }
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      // Don't throw error to avoid revealing if user exists
    }
  }
}
