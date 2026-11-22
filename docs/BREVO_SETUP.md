# Brevo transactional sending setup

The site's existing templates and reviewer outbox can send through Brevo's
transactional API. No new email template needs to be created in Brevo.

## Before enabling live sending

1. In Brevo, authenticate `nyrj.org` and register a sender address on that
   domain. Add the exact DNS records shown in the Brevo account, then wait for
   verification. Keep only one SPF TXT record at each DNS name; merge authorized
   senders if other services still send from that name.
2. Create a Brevo API v3 key with transactional email access. Set these
   **server-only** environment variables in the deployed site:

   ```env
   EMAIL_PROVIDER=brevo
   BREVO_API_KEY=your_brevo_api_v3_key
   BREVO_FROM_EMAIL=noreply@nyrj.org
   ```

   Use the actual verified sender address for `BREVO_FROM_EMAIL`. Optionally
   set `BREVO_FROM_NAME`; it defaults to `National Youth Research Journal`.
   Do not commit the key or use a `VITE_` variable.

3. Deploy, then send one controlled reviewer notification to a mailbox you
   own. Check Inbox, Spam, SPF/DKIM/DMARC headers, and Brevo **Transactional →
   Logs** before releasing queued messages. Brevo returns a message ID when it
   accepts a request; its logs show later delivery or bounce events.

The free plan currently allows 300 sends per day. Brevo may hold up to 1,000
additional transactional messages in its own retry queue when the limit is
reached. Do not blindly replay accepted messages from the site's archive.
The site records provider acceptance; staff must consult Brevo's logs for
delivered, bounced, blocked, or deferred results until a verified webhook is
connected.

References: [Brevo transactional API](https://developers.brevo.com/reference/send-transac-email),
[domain authentication](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC),
[transactional logs](https://help.brevo.com/hc/en-us/articles/360021533839-Manage-your-transactional-logs-and-email-previews).
