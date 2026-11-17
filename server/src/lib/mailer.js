import nodemailer from 'nodemailer';

const OUTBOX_LIMIT = 50;

/**
 * Builds ctx.mailer. With SMTP configured it sends real email. Without it, each message is
 * printed to the server console (silently under test) and kept in `mailer.outbox`, newest last,
 * so a developer can copy a reset link and a test can assert on what would have been sent.
 */
export function createMailer(ctx) {
  const { smtp } = ctx.config;
  const configured = Boolean(smtp.host);
  const outbox = [];
  let transport = null;

  function sender() {
    if (smtp.from) return smtp.from;
    const storeName = ctx.settings.get().storeName.replace(/["<>\r\n]/g, '');
    let address = smtp.user;
    if (!address.includes('@')) {
      let host = 'localhost';
      try {
        host = new URL(ctx.config.publicUrl).hostname;
      } catch {
        // PUBLIC_URL is not a URL: keep the placeholder host.
      }
      address = `no-reply@${host}`;
    }
    return `"${storeName}" <${address}>`;
  }

  /**
   * Sends one email. Never throws and never rejects: an order must not fail because the
   * mail server is down. Resolves to { ok, logged?, messageId?, reason? }.
   */
  async function send({ to, subject, text, html, replyTo } = {}) {
    try {
      if (!to || !subject) return { ok: false, reason: 'incomplete' };
      const message = { from: sender(), to, subject, text, html, replyTo };

      if (!configured) {
        outbox.push(message);
        if (outbox.length > OUTBOX_LIMIT) outbox.shift();
        if (!ctx.config.isTest) {
          const body = text ?? '(HTML only)';
          console.log(`[mail] SMTP is not configured, so this email was not sent.\n  To: ${to}\n  Subject: ${subject}\n${body.replace(/^/gm, '  ')}`);
        }
        return { ok: true, logged: true };
      }

      transport ??= nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
      const info = await transport.sendMail(message);
      return { ok: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[mail] Could not send "${subject}" to ${to}: ${err.message}`);
      return { ok: false, reason: 'failed' };
    }
  }

  return { send, configured, outbox };
}
