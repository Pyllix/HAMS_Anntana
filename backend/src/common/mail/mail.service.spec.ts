import nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

describe('MailService', () => {
  let mailService: MailService;
  let mockSendMail: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-message-id' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
    });

    mailService = new MailService();
  });

  it('should be defined', () => {
    expect(mailService).toBeDefined();
  });

  describe('sendVerificationEmail', () => {
    it('should send email with correct recipient, subject, and verification URL', async () => {
      const params = {
        to: 'test@hospital.go.th',
        name: 'ดร.สมชาย ใจดี',
        verificationUrl: 'http://localhost:3000/api/auth/verify-email?token=token123&callbackURL=http%3A%2F%2Flocalhost%3A5173%2Flogin',
      };

      await mailService.sendVerificationEmail(params);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];

      expect(mailOptions.to).toBe(params.to);
      expect(mailOptions.subject).toBe('[HAMS] กรุณายืนยันที่อยู่อีเมลของคุณ');
      expect(mailOptions.html).toContain(params.verificationUrl);
      expect(mailOptions.html).toContain(params.name);
      expect(mailOptions.text).toContain(params.verificationUrl);
      expect(mailOptions.text).toContain(params.name);
    });

    it('should fallback to email when name is not provided', async () => {
      const params = {
        to: 'anonymous@hospital.go.th',
        verificationUrl: 'http://localhost:3000/api/auth/verify-email?token=abc',
      };

      await mailService.sendVerificationEmail(params);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];

      expect(mailOptions.html).toContain('anonymous@hospital.go.th');
      expect(mailOptions.text).toContain('anonymous@hospital.go.th');
    });

    it('should throw error when transporter.sendMail fails', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP Connection Refused'));

      const params = {
        to: 'fail@hospital.go.th',
        name: 'Fail User',
        verificationUrl: 'http://localhost:3000/api/auth/verify-email?token=fail',
      };

      await expect(mailService.sendVerificationEmail(params)).rejects.toThrow(
        'SMTP Connection Refused',
      );
    });
  });
});
