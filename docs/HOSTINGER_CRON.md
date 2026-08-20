# Hostinger VPS cron replacement (booking expiry)

`vercel.json`'s `crons` entry (`POST /api/v1/booking/expire`, daily at
midnight) only takes effect when the app is actually deployed on Vercel.
On a Hostinger VPS (or any plain Node host), that config is inert — an
external scheduler has to call the same endpoint on the same schedule
instead. This doc is deployment preparation only; nothing here has been
run against a real VPS.

The endpoint itself needs no code change — `bookingRouter.ts`'s
`POST /booking/expire` already accepts calls from anywhere, optionally
gated by `CRON_SECRET` (`Authorization: Bearer <secret>`) when that env
var is set on the API server.

## Option A — systemd timer (recommended)

Two unit files, installed on the VPS (not part of this repo's runtime,
just reference content to copy into place during deployment):

`/etc/systemd/system/choosify-booking-expire.service`
```ini
[Unit]
Description=Choosify booking-expiry sweep (one-shot)
After=network-online.target

[Service]
Type=oneshot
Environment=CHOOSIFY_API_URL=https://dashboard.choosify.bd
EnvironmentFile=-/etc/choosify/booking-expire-cron.env
ExecStart=/usr/local/bin/booking-expire-cron.sh
```

`/etc/systemd/system/choosify-booking-expire.timer`
```ini
[Unit]
Description=Run Choosify booking-expiry sweep daily at midnight

[Timer]
OnCalendar=*-*-* 00:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Setup:
```bash
sudo cp scripts/cron/booking-expire-cron.sh /usr/local/bin/booking-expire-cron.sh
sudo chmod +x /usr/local/bin/booking-expire-cron.sh
echo 'CRON_SECRET=<real-secret>' | sudo tee /etc/choosify/booking-expire-cron.env
sudo systemctl daemon-reload
sudo systemctl enable --now choosify-booking-expire.timer
```

## Option B — plain crontab

```
0 0 * * * CHOOSIFY_API_URL=https://dashboard.choosify.bd CRON_SECRET=<real-secret> /usr/local/bin/booking-expire-cron.sh >> /var/log/choosify-booking-expire.log 2>&1
```

## Verifying

Either option ultimately runs `scripts/cron/booking-expire-cron.sh`
(committed in this repo), which does a single authenticated `POST
/api/v1/booking/expire` and exits non-zero on failure (`curl --fail`),
so systemd/cron failure states/alerts work normally.
