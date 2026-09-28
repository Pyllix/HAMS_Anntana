import nodemailer, { Transporter } from 'nodemailer';

export interface SendVerificationEmailParams {
  to: string;
  name?: string;
  verificationUrl: string;
}

export interface SendTwoFactorResetNoticeParams {
  to: string;
  name?: string;
  resetAt: Date;
}

export interface SendBootstrapAdminCredentialsParams {
  to: string;
  name: string;
  userName: string;
  initialPassword: string;
}

export class MailService {
  private transporter: Transporter;
  private defaultFrom: string;

  constructor() {
    const host = process.env.SMTP_HOST || 'localhost';
    const port = parseInt(process.env.SMTP_PORT || '1025', 10);
    const secure = process.env.SMTP_SECURE === 'true';
    const requireTLS = process.env.SMTP_REQUIRE_TLS === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    this.defaultFrom =
      process.env.SMTP_FROM || 'HAMS System <noreply@hams.local>';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: user ? { user, pass } : undefined,
    });
  }

  /**
   * ส่งอีเมลยืนยันตัวตนพร้อม Verification Link สำหรับ Better Auth
   */
  async sendVerificationEmail(
    params: SendVerificationEmailParams,
  ): Promise<void> {
    const { to, name, verificationUrl } = params;
    const displayName = name?.trim() || to;

    const htmlContent = `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ยืนยันที่อยู่อีเมลของคุณ - ระบบ HAMS</title>
  <style>
    body {
      font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f6f9;
      margin: 0;
      padding: 0;
      color: #333333;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: #ffffff;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 32px 24px;
      line-height: 1.6;
    }
    .btn-container {
      text-align: center;
      margin: 30px 0;
    }
    .btn {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      padding: 12px 32px;
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
    }
    .link-fallback {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      font-size: 12px;
      word-break: break-all;
      color: #64748b;
      margin-top: 20px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 16px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ระบบบริหารจัดการครุภัณฑ์โรงพยาบาล (HAMS)</h1>
    </div>
    <div class="content">
      <p style="font-size: 16px;"><strong>เรียนคุณ ${displayName},</strong></p>
      <p>
        มีการสร้างบัญชีผู้ใช้งานสำหรับคุณในระบบ HAMS เพื่อความปลอดภัยในการใช้งาน กรุณายืนยันที่อยู่อีเมลของคุณโดยคลิกที่ปุ่มด้านล่างนี้:
      </p>
      <div class="btn-container">
        <a href="${verificationUrl}" class="btn" target="_blank">ยืนยันที่อยู่อีเมล</a>
      </div>
      <p style="color: #64748b; font-size: 14px;">
        * ลิงก์ยืนยันตัวตนนี้จะมีอายุการใช้งาน <strong>1 ชั่วโมง</strong> หลังจากได้รับอีเมลนี้
      </p>
      <p style="font-size: 13px; color: #64748b;">
        หากปุ่มด้านบนใช้งานไม่ได้ สามารถคัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์ของคุณ:
      </p>
      <div class="link-fallback">
        <a href="${verificationUrl}" style="color: #2563eb;">${verificationUrl}</a>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Hospital Asset Management System (HAMS). All rights reserved.</p>
      <p>หากคุณไม่ได้ร้องขอบัญชีนี้ สามารถละเว้นอีเมลฉบับนี้ได้โดยปลอดภัย</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent =
      `เรียนคุณ ${displayName},\n\n` +
      `มีการสร้างบัญชีผู้ใช้งานสำหรับคุณในระบบบริหารจัดการครุภัณฑ์โรงพยาบาล (HAMS)\n` +
      `กรุณายืนยันที่อยู่อีเมลของคุณโดยเปิดลิงก์ต่อไปนี้:\n\n` +
      `${verificationUrl}\n\n` +
      `* ลิงก์ยืนยันตัวตนนี้จะมีอายุ 1 ชั่วโมง\n\n` +
      `หากคุณไม่ได้ร้องขอบัญชีนี้ สามารถละเว้นอีเมลฉบับนี้ได้`;

    try {
      const info = await this.transporter.sendMail({
        from: this.defaultFrom,
        to,
        subject: '[HAMS] กรุณายืนยันที่อยู่อีเมลของคุณ',
        text: textContent,
        html: htmlContent,
      });

      console.log(
        `[MailService] Verification email sent to: ${to} (MessageId: ${info.messageId})`,
      );
    } catch (error) {
      console.error(
        `[MailService] Error sending verification email to ${to}:`,
        error,
      );
      console.warn(
        '[MailService] ⚠️ Make sure your SMTP server or Mailpit is running (e.g. docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit)',
      );
      throw error;
    }
  }

  async sendTwoFactorResetNotice(
    params: SendTwoFactorResetNoticeParams,
  ): Promise<void> {
    const displayName = params.name?.trim() || params.to;
    const resetAt = params.resetAt.toISOString();
    const text =
      `เรียนคุณ ${displayName},\n\n` +
      `ผู้ดูแลระบบได้รีเซ็ตการยืนยันตัวตนสองขั้นตอนของบัญชี HAMS ของคุณ ` +
      `เมื่อ ${resetAt} โดย Authenticator และ Recovery Codes เดิมถูกยกเลิกแล้ว\n\n` +
      `เมื่อลงชื่อเข้าใช้ครั้งถัดไป คุณจะต้องลงทะเบียน Authenticator และยืนยัน Recovery Codes ชุดใหม่ก่อนเข้าใช้งานระบบ\n\n` +
      `หากคุณไม่ได้ร้องขอการดำเนินการนี้ โปรดติดต่อผู้ดูแลระบบของโรงพยาบาลทันที`;

    try {
      await this.transporter.sendMail({
        from: this.defaultFrom,
        to: params.to,
        subject: '[HAMS] มีการรีเซ็ตการยืนยันตัวตนสองขั้นตอน',
        text,
      });
    } catch (error) {
      console.error('[MailService] Error sending 2FA reset notice:', error);
      throw error;
    }
  }

  async sendBootstrapAdminCredentials(
    params: SendBootstrapAdminCredentialsParams,
  ): Promise<void> {
    const text =
      `เรียนคุณ ${params.name},\n\n` +
      `บัญชีผู้ดูแลระบบ HAMS ของคุณกำลังถูกเตรียมใช้งาน\n` +
      `ชื่อผู้ใช้: ${params.userName}\n` +
      `รหัสผ่านเริ่มต้น: ${params.initialPassword}\n\n` +
      `ระบบจะส่งอีเมลยืนยันที่อยู่อีเมลแยกอีกฉบับ หลังยืนยันแล้วให้ลงชื่อเข้าใช้และตั้งค่า Authenticator กับ Recovery Codes ด้วยตนเอง\n` +
      `ระบบไม่บังคับเปลี่ยนรหัสผ่านนี้เมื่อเข้าสู่ระบบครั้งแรก โปรดเก็บรหัสผ่านไว้อย่างปลอดภัยและลบอีเมลฉบับนี้หลังบันทึกข้อมูลแล้ว`;

    try {
      await this.transporter.sendMail({
        from: this.defaultFrom,
        to: params.to,
        subject: '[HAMS] ข้อมูลเริ่มต้นบัญชีผู้ดูแลระบบ',
        text,
      });
      console.log(
        `[MailService] Initial ADMIN credentials sent to: ${params.to}`,
      );
    } catch {
      // Deliberately never log the message or the SMTP error object here.
      console.error(
        `[MailService] Initial ADMIN credentials delivery failed to: ${params.to}`,
      );
      throw new Error('Unable to deliver ADMIN bootstrap credentials');
    }
  }
}

export const mailService = new MailService();
