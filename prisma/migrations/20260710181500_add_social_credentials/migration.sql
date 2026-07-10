-- CreateEnum
CREATE TYPE "SocialCredentialPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'THREADS', 'TELEGRAM');

-- CreateTable
CREATE TABLE "social_credentials" (
    "id" SERIAL NOT NULL,
    "platform" "SocialCredentialPlatform" NOT NULL,
    "access_token" TEXT NOT NULL,
    "account_id" TEXT,
    "account_username" TEXT,
    "expires_at" TIMESTAMP(3),
    "last_refreshed_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "refresh_enabled" BOOLEAN NOT NULL DEFAULT false,
    "refresh_failures" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "last_error_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_credentials_platform_key" ON "social_credentials"("platform");
