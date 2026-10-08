-- Database Schema for CAS Fitness Web Application
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Roles Definition Table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    permissions JSONB DEFAULT '{}'::jsonb
);

-- 2. Master Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role_id INT REFERENCES roles(id),
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'INACTIVE')),
    -- Optional time window for the current status (e.g. a Suspended period).
    -- NULL status_ends_at means the status is permanent/indefinite.
    status_starts_at TIMESTAMPTZ,
    status_ends_at TIMESTAMPTZ,
    session_version INT DEFAULT 1,
    failed_login_attempts INT DEFAULT 0,
    account_locked_until TIMESTAMPTZ,
    temp_password_hash VARCHAR(255),
    temp_password_expires_at TIMESTAMPTZ,
    password_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Pre-Authorized Email System
CREATE TABLE IF NOT EXISTS authorized_emails (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. OTP Tokens Table
CREATE TABLE IF NOT EXISTS otp_codes (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    purpose VARCHAR(50) CHECK (purpose IN ('2FA', 'PASSWORD_RESET')),
    expires_at TIMESTAMPTZ NOT NULL,
    failed_attempts INT DEFAULT 0,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Membership Plans
CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    billing_cycle VARCHAR(50) NOT NULL,
    session_count INT DEFAULT 0,
    photo_url TEXT,
    photo_storage_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. User Subscriptions Mapping
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id INT REFERENCES plans(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    auto_renew BOOLEAN DEFAULT TRUE,
    remaining_sessions INT DEFAULT 0
);

-- 7. Consultation Appointments
CREATE TABLE IF NOT EXISTS consultation_appointments (
    id SERIAL PRIMARY KEY,
    client_name VARCHAR(150) NOT NULL,
    client_email VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50),
    employee_id UUID REFERENCES users(id),
    format VARCHAR(20) CHECK (format IN ('IN_PERSON', 'VIDEO')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELED')),
    reserved_until TIMESTAMPTZ,
    consent_given BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Workout Sessions
CREATE TABLE IF NOT EXISTS workout_sessions (
    id SERIAL PRIMARY KEY,
    trainer_id UUID REFERENCES users(id),
    student_id UUID REFERENCES users(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    break_duration_minutes INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'FAILED', 'ABSENT')),
    reserved_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Trainer Availability Rules
CREATE TABLE IF NOT EXISTS trainer_availability (
    id SERIAL PRIMARY KEY,
    trainer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location_format VARCHAR(30) NOT NULL CHECK (location_format IN ('IN_PERSON', 'VIDEO', 'STUDENT_CHOICE'))
);

-- 10. Trainer Vacations
CREATE TABLE IF NOT EXISTS trainer_vacations (
    id SERIAL PRIMARY KEY,
    trainer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL
);

-- 11. Promotion Rules
CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    campaign_name VARCHAR(200) NOT NULL,
    -- NULL plan_id = the promotion applies site-wide to every plan card.
    plan_id INT REFERENCES plans(id) ON DELETE CASCADE,
    discount_type VARCHAR(30) NOT NULL CHECK (discount_type IN ('AMOUNT', 'PERCENTAGE')),
    discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value >= 0),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CMS Content Engine
CREATE TABLE IF NOT EXISTS cms_content (
    id SERIAL PRIMARY KEY,
    page_key VARCHAR(100) UNIQUE NOT NULL,
    content JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Door Scan Logs
CREATE TABLE IF NOT EXISTS door_access_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Landing Page Carousel Ribbon Cards
-- Each row is a "card slot" in the carousel. image_url/storage_key stay NULL
-- until a Superuser uploads an image; deleting just the image clears these
-- two columns without removing the row (the slot persists).
CREATE TABLE IF NOT EXISTS carousel_cards (
    id SERIAL PRIMARY KEY,
    position INT NOT NULL,
    image_url TEXT,
    storage_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_carousel_cards_position ON carousel_cards(position);

-- 12. Superuser Calendar Settings
CREATE TABLE IF NOT EXISTS calendar_settings (
    id SERIAL PRIMARY KEY,
    slot_duration_minutes INT DEFAULT 60,
    break_duration_minutes INT DEFAULT 15,
    cancellation_cutoff_hours INT DEFAULT 24,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent additive migrations for databases created before the columns
-- above existed (schema.sql is safe to re-run against an existing database).
-- Must run before any indexes below that reference these columns.
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_starts_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_ends_at TIMESTAMPTZ;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS plan_id INT REFERENCES plans(id) ON DELETE CASCADE;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE plans ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS photo_storage_key TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE plans ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS auto_completed_at TIMESTAMPTZ;

-- Fix foreign key constraint on user_subscriptions to allow cascading deletes
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_id_fkey;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;

-- NEW: Scheduled Slot Templates (created by superuser)
-- Defines recurring pattern: which days, time range, date range, calendar type
CREATE TABLE IF NOT EXISTS scheduled_slot_templates (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    calendar_type VARCHAR(50) NOT NULL CHECK (calendar_type IN ('WORKOUT', 'CONSULTATION')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_minutes INT NOT NULL,
    location_format VARCHAR(30) CHECK (location_format IN ('IN_PERSON', 'VIDEO', 'STUDENT_CHOICE')),
    -- Days of week as JSON array: [0, 1, 2, 3, 4, 5, 6] = Sun-Sat
    days_of_week INT[] NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approval_by UUID REFERENCES users(id),
    approval_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: Slot Instances (individual time blocks generated from templates or manually created)
-- Each slot instance can be modified by the user or superuser
CREATE TABLE IF NOT EXISTS slot_instances (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id INT REFERENCES scheduled_slot_templates(id) ON DELETE SET NULL,
    calendar_type VARCHAR(50) NOT NULL CHECK (calendar_type IN ('WORKOUT', 'CONSULTATION')),
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    -- Status options: APPROVED (initial), CONSULTATION, WORKOUT, BREAK, LUNCH, SICK, NO_SHOW, VACATION, PERSONAL_TIME, REMOVED
    -- APPROVED = created but not yet assigned a specific type
    -- CONSULTATION = available for consultation bookings
    -- WORKOUT = available for workout bookings
    -- BREAK/LUNCH = unavailable (shows as break/lunch to public)
    -- SICK/NO_SHOW/VACATION/PERSONAL_TIME = unavailable (shows as unavailable except VACATION shows as "Vacation")
    -- REMOVED = hidden completely
    status VARCHAR(50) DEFAULT 'APPROVED' CHECK (status IN ('APPROVED', 'CONSULTATION', 'WORKOUT', 'BREAK', 'LUNCH', 'SICK', 'NO_SHOW', 'VACATION', 'PERSONAL_TIME', 'BOOKED', 'REMOVED')),
    -- Publish date/time: slot is hidden until this time
    published_at TIMESTAMPTZ,
    -- For member-made changes (CONSULTATION, WORKOUT, BREAK, LUNCH)
    modified_by UUID REFERENCES users(id),
    modified_at TIMESTAMPTZ,
    -- For superuser-only changes (SICK, NO_SHOW, VACATION, PERSONAL_TIME, REMOVED)
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role_id, status);
CREATE INDEX IF NOT EXISTS idx_otp_user_purpose ON otp_codes(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_consultation_reserved_until ON consultation_appointments(reserved_until);
CREATE INDEX IF NOT EXISTS idx_workout_reserved_until ON workout_sessions(reserved_until);
CREATE INDEX IF NOT EXISTS idx_promotions_plan_id ON promotions(plan_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_slot_templates_user ON scheduled_slot_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_slot_templates_status ON scheduled_slot_templates(status);
CREATE INDEX IF NOT EXISTS idx_slot_instances_user_date ON slot_instances(user_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_slot_instances_status_published ON slot_instances(status, published_at);
CREATE INDEX IF NOT EXISTS idx_slot_instances_status ON slot_instances(status);

-- Trainer Session Management Tables
-- Package templates for trainer sessions (created by superuser or staff)
CREATE TABLE IF NOT EXISTS trainer_session_packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    session_count INT NOT NULL CHECK (session_count > 0),
    duration_minutes INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    created_by UUID NOT NULL REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student trainer session assignments (links a student to a trainer for a set of sessions)
CREATE TABLE IF NOT EXISTS student_trainer_sessions (
    id SERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    package_id INT REFERENCES trainer_session_packages(id) ON DELETE SET NULL,
    total_sessions INT NOT NULL CHECK (total_sessions > 0),
    remaining_sessions INT NOT NULL CHECK (remaining_sessions >= 0),
    start_date TIMESTAMPTZ NOT NULL,
    expiration_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED')),
    assigned_by UUID NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual session logs for each student-trainer session package
CREATE TABLE IF NOT EXISTS student_trainer_session_logs (
    id SERIAL PRIMARY KEY,
    student_trainer_session_id INT NOT NULL REFERENCES student_trainer_sessions(id) ON DELETE CASCADE,
    slot_instance_id INT REFERENCES slot_instances(id) ON DELETE SET NULL,
    session_number INT NOT NULL,
    scheduled_date TIMESTAMPTZ,
    completed_date TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW')),
    location_format VARCHAR(30) CHECK (location_format IN ('IN_PERSON', 'VIDEO')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trainer_session_packages_created_by ON trainer_session_packages(created_by);
CREATE INDEX IF NOT EXISTS idx_trainer_session_packages_active ON trainer_session_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_student_trainer_sessions_student ON student_trainer_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_trainer_sessions_trainer ON student_trainer_sessions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_student_trainer_sessions_status ON student_trainer_sessions(status);
CREATE INDEX IF NOT EXISTS idx_student_trainer_sessions_dates ON student_trainer_sessions(start_date, expiration_date);
CREATE INDEX IF NOT EXISTS idx_student_trainer_session_logs_session ON student_trainer_session_logs(student_trainer_session_id);
CREATE INDEX IF NOT EXISTS idx_student_trainer_session_logs_status ON student_trainer_session_logs(status);

-- Add missing columns to existing tables
ALTER TABLE student_trainer_session_logs ADD COLUMN IF NOT EXISTS slot_instance_id INT REFERENCES slot_instances(id) ON DELETE SET NULL;

-- Ensure BOOKED status exists in slot_instances
ALTER TABLE slot_instances DROP CONSTRAINT IF EXISTS slot_instances_status_check;
ALTER TABLE slot_instances ADD CONSTRAINT slot_instances_status_check CHECK (status IN ('APPROVED', 'CONSULTATION', 'WORKOUT', 'BREAK', 'LUNCH', 'SICK', 'NO_SHOW', 'VACATION', 'PERSONAL_TIME', 'BOOKED', 'REMOVED'));