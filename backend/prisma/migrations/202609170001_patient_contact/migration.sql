-- Existing appointments retain null contact details; new bookings require both fields.
ALTER TABLE "Appointment"
ADD COLUMN "email" VARCHAR(254),
ADD COLUMN "phone" VARCHAR(13);
