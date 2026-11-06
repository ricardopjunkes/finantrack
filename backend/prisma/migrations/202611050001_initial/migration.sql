-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('income', 'expense');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#10B981',
    "icon" VARCHAR(60) NOT NULL DEFAULT 'tag',
    "userId" UUID NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "description" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(11,2) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "date" DATE NOT NULL,
    "categoryId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "targetAmount" DECIMAL(11,2) NOT NULL,
    "currentAmount" DECIMAL(11,2) NOT NULL DEFAULT 0,
    "deadline" DATE,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_userId_name_type_key" ON "categories"("userId", "name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "categories_id_userId_type_key" ON "categories"("id", "userId", "type");

-- CreateIndex
CREATE INDEX "transactions_userId_date_idx" ON "transactions"("userId", "date");

-- CreateIndex
CREATE INDEX "transactions_categoryId_userId_type_idx" ON "transactions"("categoryId", "userId", "type");

-- CreateIndex
CREATE INDEX "goals_userId_deadline_idx" ON "goals"("userId", "deadline");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_userId_type_fkey" FOREIGN KEY ("categoryId", "userId", "type") REFERENCES "categories"("id", "userId", "type") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Regras também no banco, inclusive para gravações fora da API.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_description_not_blank" CHECK (length(trim("description")) > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_date_range" CHECK ("date" BETWEEN DATE '1900-01-01' AND DATE '9999-12-31');
ALTER TABLE "categories" ADD CONSTRAINT "categories_name_not_blank" CHECK (length(trim("name")) > 0);
ALTER TABLE "categories" ADD CONSTRAINT "categories_color_hex" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "goals" ADD CONSTRAINT "goals_amounts_valid" CHECK ("targetAmount" > 0 AND "currentAmount" >= 0);
