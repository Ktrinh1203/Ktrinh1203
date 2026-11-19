-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('OFFLINE', 'ONLINE', 'STREAMING', 'ALERT');

-- CreateEnum
CREATE TYPE "DeviceAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "HardwareDevice" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "deviceCode" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "model" VARCHAR(60) NOT NULL DEFAULT 'ESP32_ADS1299_V3',
    "firmwareVersion" VARCHAR(30) NOT NULL DEFAULT 'V3.0.0',
    "montage" VARCHAR(30) NOT NULL DEFAULT 'neurolink6',
    "sampleRateSps" INTEGER NOT NULL DEFAULT 500,
    "pgaGain" INTEGER NOT NULL DEFAULT 24,
    "apiKeyHash" VARCHAR(64) NOT NULL,
    "apiKeyPrefix" VARCHAR(16) NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "connectionSource" VARCHAR(30) NOT NULL DEFAULT 'NONE',
    "ipAddress" VARCHAR(64),
    "lastSeenAt" TIMESTAMP(3),
    "lastBatteryMv" INTEGER,
    "lastBatteryPct" INTEGER,
    "lastAiState" VARCHAR(40),
    "lastAiRfProb" DOUBLE PRECISION,
    "lastAiBsi" DOUBLE PRECISION,
    "lastAiDar" DOUBLE PRECISION,
    "lastLeadOffMask" INTEGER,
    "sdRecording" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HardwareDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceTelemetryLog" (
    "id" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "mode" VARCHAR(20) NOT NULL,
    "rateSps" INTEGER NOT NULL,
    "pga" INTEGER NOT NULL,
    "actualSps" DOUBLE PRECISION,
    "vbatMv" INTEGER NOT NULL,
    "batPct" INTEGER NOT NULL,
    "usbOnly" BOOLEAN NOT NULL DEFAULT false,
    "sdRec" BOOLEAN NOT NULL DEFAULT false,
    "markers" INTEGER NOT NULL DEFAULT 0,
    "loffMask" INTEGER NOT NULL DEFAULT 0,
    "aiState" VARCHAR(40) NOT NULL,
    "aiRfProb" DOUBLE PRECISION,
    "aiLrProb" DOUBLE PRECISION,
    "aiBsi" DOUBLE PRECISION,
    "aiDar" DOUBLE PRECISION,
    "aiUsableCh" INTEGER,
    "source" VARCHAR(30) NOT NULL DEFAULT 'WS_DIRECT',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceTelemetryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceAlert" (
    "id" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "severity" "DeviceAlertSeverity" NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceRecordingSession" (
    "id" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "montage" VARCHAR(30) NOT NULL,
    "sampleRateSps" INTEGER NOT NULL,
    "channelNames" TEXT[],
    "sampleCount" INTEGER NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "csvSummary" TEXT,
    "qeegResultJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceRecordingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HardwareDevice_deviceCode_key" ON "HardwareDevice"("deviceCode");

-- CreateIndex
CREATE INDEX "HardwareDevice_ownerId_createdAt_idx" ON "HardwareDevice"("ownerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "HardwareDevice_status_idx" ON "HardwareDevice"("status");

-- CreateIndex
CREATE INDEX "DeviceTelemetryLog_deviceId_recordedAt_idx" ON "DeviceTelemetryLog"("deviceId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "DeviceAlert_deviceId_createdAt_idx" ON "DeviceAlert"("deviceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DeviceRecordingSession_deviceId_startedAt_idx" ON "DeviceRecordingSession"("deviceId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "DeviceRecordingSession_ownerId_startedAt_idx" ON "DeviceRecordingSession"("ownerId", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "HardwareDevice" ADD CONSTRAINT "HardwareDevice_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceTelemetryLog" ADD CONSTRAINT "DeviceTelemetryLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "HardwareDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAlert" ADD CONSTRAINT "DeviceAlert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "HardwareDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceRecordingSession" ADD CONSTRAINT "DeviceRecordingSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "HardwareDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceRecordingSession" ADD CONSTRAINT "DeviceRecordingSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
