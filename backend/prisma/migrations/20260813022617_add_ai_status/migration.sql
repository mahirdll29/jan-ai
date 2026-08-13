-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "aiStatus" "AiStatus" NOT NULL DEFAULT 'PENDING';
