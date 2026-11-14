-- Englische Fassung je Call-Vorlage (leer = Haupttext); Standardvorlagen bekommen den englischen Text, wenn ihr Text unverändert ist.
ALTER TABLE "CallTemplate" ADD COLUMN "bodyEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AllianceCall" ADD COLUMN "templateEn" TEXT NOT NULL DEFAULT '';
UPDATE "CallTemplate" SET "bodyEn" = '⚔️ **Attack** on **{player}** – {village} {coords}
Time: {time}
{link}
{note}' WHERE "kind" = 'ATTACK' AND "body" = '⚔️ **Angriff** auf **{spieler}** – {dorf} {koordinaten}
Zeit: {zeit}
{link}
{notiz}';
UPDATE "CallTemplate" SET "bodyEn" = '🛡️ **Defence call** for **{player}** – {village} {coords}
Until: {time}
Please send troops: {link}
{note}' WHERE "kind" = 'DEFF' AND "body" = '🛡️ **Deff-Call** für **{spieler}** – {dorf} {koordinaten}
Bis: {zeit}
Bitte Truppen schicken: {link}
{notiz}';
UPDATE "CallTemplate" SET "bodyEn" = '⚔️ **Attack day** {time}
{title}
{note}' WHERE "kind" = 'ATTACK_DAY' AND "body" = '⚔️ **Angriffstag** {zeit}
{titel}
{notiz}';
UPDATE "CallTemplate" SET "bodyEn" = '📣 **{title}**
{time}
{village} {coords}
{note}' WHERE "kind" = 'OTHER' AND "body" = '📣 **{titel}**
{zeit}
{dorf} {koordinaten}
{notiz}';
