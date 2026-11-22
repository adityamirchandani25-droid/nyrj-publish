# Mailtrap live sending setup

The app's existing email templates, delivery archive, and reviewer outbox now support
Mailtrap Email Live Sending through the official `mailtrap` Node.js SDK. Mailtrap is
selected only when `EMAIL_PROVIDER=mailtrap` is set on the server. The default remains
SendGrid until that switch is made.

## Values to set before live sending

1. Create a Mailtrap **Email Live Sending** account and verify `nyrj.org` in Sending
   Domains. Add the exact SPF and DKIM records that Mailtrap displays for the domain;
   do not copy demo DNS values blindly. Complete Mailtrap's compliance check.
2. Create an Email Live Sending API token. Store it as `MAILTRAP_API_KEY` in the
   deployed server environment and in `.env.local` for local use. Do not add a
   `VITE_` prefix or commit the token.
3. Set `MAILTRAP_FROM_EMAIL` to an address on the verified domain, such as
   `noreply@nyrj.org`, if Mailtrap has approved that address. The sample sender
   `hello@demomailtrap.co` is a demo placeholder and must not be used for NYRJ mail.
4. Set `EMAIL_PROVIDER=mailtrap`. Optionally set `MAILTRAP_FROM_NAME`; the default
   is `National Youth Research Journal`.
5. Deploy the environment changes and code. Run one controlled reviewer-template
   send to a mailbox you own, then check Inbox, Spam, authentication headers, and
   [Mailtrap Email Logs](https://mailtrap.io/sending/email_logs) before retrying
   queued reviewer notifications.

The sample recipient `adityamirchandani123@gmail.com` is only a test destination;
the application uses the actual student or reviewer address from each workflow.
The sample subject, body, and category are replaced by the app's existing templates.
Do not put a real API token in the source file or in chat.

Mailtrap's free live-sending plan has daily and monthly limits. A request accepted
by its API is not proof of inbox delivery. The site's archive records acceptance
and failures; use Mailtrap's Email Logs for delivery and bounce events until a
verified event webhook is connected to the site.
