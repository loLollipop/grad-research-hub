-- Grad Research Hub MVP schema for SQLite.
-- Prisma remains the source data model; this SQL avoids a Prisma schema-engine
-- issue observed under the current Windows/non-ASCII workspace path.

CREATE TABLE IF NOT EXISTS "Paper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "authors" TEXT NOT NULL DEFAULT '[]',
    "year" INTEGER,
    "abstract" TEXT,
    "journal" TEXT,
    "doi" TEXT,
    "arxivId" TEXT,
    "zoteroKey" TEXT,
    "bibtexKey" TEXT,
    "category" TEXT NOT NULL DEFAULT 'inbox',
    "readStatus" TEXT NOT NULL DEFAULT 'unread',
    "pdfUrl" TEXT,
    "externalUrl" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "milestoneId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "dueDate" DATETIME,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Experiment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "template" TEXT NOT NULL DEFAULT 'standard',
    "content" TEXT NOT NULL DEFAULT '',
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "externalRunId" TEXT,
    "repositoryUrl" TEXT,
    "gitCommit" TEXT,
    "artifactPath" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Experiment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "folder" TEXT NOT NULL DEFAULT 'Inbox',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Dataset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "source" TEXT,
    "version" TEXT,
    "description" TEXT,
    "path" TEXT,
    "externalUrl" TEXT,
    "dvcPath" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experimentId" TEXT,
    "datasetId" TEXT,
    "title" TEXT NOT NULL,
    "metrics" TEXT NOT NULL DEFAULT '{}',
    "config" TEXT NOT NULL DEFAULT '{}',
    "mlflowRunId" TEXT,
    "dvcExpName" TEXT,
    "gitCommit" TEXT,
    "artifactPath" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Result_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Result_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AdminItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'meeting',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "dueDate" DATETIME,
    "location" TEXT,
    "notes" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "_ExperimentToPaper" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ExperimentToPaper_A_fkey" FOREIGN KEY ("A") REFERENCES "Experiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ExperimentToPaper_B_fkey" FOREIGN KEY ("B") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Paper_readStatus_idx" ON "Paper"("readStatus");
CREATE INDEX IF NOT EXISTS "Paper_category_idx" ON "Paper"("category");
CREATE INDEX IF NOT EXISTS "Paper_zoteroKey_idx" ON "Paper"("zoteroKey");
CREATE INDEX IF NOT EXISTS "Project_status_idx" ON "Project"("status");
CREATE INDEX IF NOT EXISTS "Milestone_projectId_idx" ON "Milestone"("projectId");
CREATE INDEX IF NOT EXISTS "Milestone_dueDate_idx" ON "Milestone"("dueDate");
CREATE INDEX IF NOT EXISTS "Milestone_status_idx" ON "Milestone"("status");
CREATE INDEX IF NOT EXISTS "Task_status_idx" ON "Task"("status");
CREATE INDEX IF NOT EXISTS "Task_priority_idx" ON "Task"("priority");
CREATE INDEX IF NOT EXISTS "Task_dueDate_idx" ON "Task"("dueDate");
CREATE INDEX IF NOT EXISTS "Experiment_status_idx" ON "Experiment"("status");
CREATE INDEX IF NOT EXISTS "Experiment_projectId_idx" ON "Experiment"("projectId");
CREATE INDEX IF NOT EXISTS "Note_folder_idx" ON "Note"("folder");
CREATE INDEX IF NOT EXISTS "Result_experimentId_idx" ON "Result"("experimentId");
CREATE INDEX IF NOT EXISTS "Result_datasetId_idx" ON "Result"("datasetId");
CREATE INDEX IF NOT EXISTS "AdminItem_type_idx" ON "AdminItem"("type");
CREATE INDEX IF NOT EXISTS "AdminItem_status_idx" ON "AdminItem"("status");
CREATE INDEX IF NOT EXISTS "AdminItem_dueDate_idx" ON "AdminItem"("dueDate");
CREATE UNIQUE INDEX IF NOT EXISTS "_ExperimentToPaper_AB_unique" ON "_ExperimentToPaper"("A", "B");
CREATE INDEX IF NOT EXISTS "_ExperimentToPaper_B_index" ON "_ExperimentToPaper"("B");
