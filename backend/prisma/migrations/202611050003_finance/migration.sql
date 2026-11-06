ALTER TABLE "categories" ADD COLUMN "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "transactions" ADD COLUMN "notes" VARCHAR(1000);
ALTER TABLE "goals" ADD COLUMN "status" VARCHAR(10) NOT NULL DEFAULT 'active';
ALTER TABLE "goals" ADD CONSTRAINT "goals_status_valid" CHECK ("status" IN ('active','completed'));
CREATE TABLE "contributions" (
 "id" UUID PRIMARY KEY, "goalId" UUID NOT NULL, "amount" DECIMAL(11,2) NOT NULL CHECK ("amount">0),
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "contributions_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "contributions_goalId_createdAt_idx" ON "contributions"("goalId","createdAt");
CREATE TABLE "budgets" (
 "id" UUID PRIMARY KEY, "userId" UUID NOT NULL, "categoryId" UUID NOT NULL, "type" "TransactionType" NOT NULL DEFAULT 'expense',
 "amount" DECIMAL(11,2) NOT NULL CHECK ("amount">0), "month" INTEGER NOT NULL CHECK ("month" BETWEEN 1 AND 12), "year" INTEGER NOT NULL CHECK ("year" BETWEEN 1900 AND 9999),
 CONSTRAINT "budgets_expense_only" CHECK ("type"='expense'),
 CONSTRAINT "budgets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "budgets_categoryId_userId_type_fkey" FOREIGN KEY ("categoryId","userId","type") REFERENCES "categories"("id","userId","type") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "budgets_userId_categoryId_month_year_key" ON "budgets"("userId","categoryId","month","year");
CREATE INDEX "budgets_userId_year_month_idx" ON "budgets"("userId","year","month");
