CREATE TYPE "AppointmentStatus" AS ENUM ('CONFIRMED', 'CANCELLED');
CREATE TABLE "Receptionist" (
  "id" TEXT PRIMARY KEY, "name" VARCHAR(120) NOT NULL, "email" VARCHAR(254) NOT NULL UNIQUE, "passwordHash" TEXT NOT NULL
);
CREATE TABLE "Appointment" (
  "id" TEXT PRIMARY KEY, "name" VARCHAR(120) NOT NULL,
  "date" DATE NOT NULL, "startMinute" INTEGER NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED', "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "cancelledAt" TIMESTAMPTZ(3), "cancelledBy" TEXT REFERENCES "Receptionist"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Appointment_slot_check" CHECK ("startMinute" BETWEEN 480 AND 1020 AND "startMinute" % 60 = 0),
  CONSTRAINT "Appointment_year_check" CHECK ("date" BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'),
  CONSTRAINT "Appointment_name_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "Appointment_version_check" CHECK ("version" > 0)
);
CREATE INDEX "Appointment_date_status_idx" ON "Appointment"("date", "status");
CREATE UNIQUE INDEX "Appointment_confirmed_slot_key" ON "Appointment"("date", "startMinute") WHERE "status" = 'CONFIRMED';
CREATE TABLE "AvailabilityBlock" (
  "id" TEXT PRIMARY KEY, "date" DATE NOT NULL, "startMinute" INTEGER, "reason" VARCHAR(300),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" TEXT NOT NULL REFERENCES "Receptionist"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "removedAt" TIMESTAMPTZ(3), "removedBy" TEXT REFERENCES "Receptionist"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AvailabilityBlock_slot_check" CHECK ("startMinute" IS NULL OR ("startMinute" BETWEEN 480 AND 1020 AND "startMinute" % 60 = 0)),
  CONSTRAINT "AvailabilityBlock_year_check" CHECK ("date" BETWEEN DATE '2026-01-01' AND DATE '2026-12-31')
);
CREATE INDEX "AvailabilityBlock_date_removedAt_idx" ON "AvailabilityBlock"("date", "removedAt");
CREATE TABLE "LoginAttempt" ("id" TEXT PRIMARY KEY, "account" VARCHAR(254) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "LoginAttempt_account_createdAt_idx" ON "LoginAttempt"("account", "createdAt");
CREATE TABLE "session" ("sid" VARCHAR PRIMARY KEY, "sess" JSON NOT NULL, "expire" TIMESTAMP(6) NOT NULL);
CREATE INDEX "IDX_session_expire" ON "session"("expire");
