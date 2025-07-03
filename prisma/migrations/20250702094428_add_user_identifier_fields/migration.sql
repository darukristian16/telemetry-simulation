-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CommandHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "command" TEXT NOT NULL,
    "userIdentifier" TEXT NOT NULL DEFAULT 'default',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CommandHistory" ("command", "createdAt", "id") SELECT "command", "createdAt", "id" FROM "CommandHistory";
DROP TABLE "CommandHistory";
ALTER TABLE "new_CommandHistory" RENAME TO "CommandHistory";
CREATE INDEX "CommandHistory_userIdentifier_idx" ON "CommandHistory"("userIdentifier");
CREATE TABLE "new_QuickCommand" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "userIdentifier" TEXT NOT NULL DEFAULT 'default'
);
INSERT INTO "new_QuickCommand" ("command", "id", "label", "position") SELECT "command", "id", "label", "position" FROM "QuickCommand";
DROP TABLE "QuickCommand";
ALTER TABLE "new_QuickCommand" RENAME TO "QuickCommand";
CREATE INDEX "QuickCommand_userIdentifier_idx" ON "QuickCommand"("userIdentifier");
CREATE TABLE "new_SerialConnection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "baudRate" INTEGER NOT NULL DEFAULT 9600,
    "dataBits" INTEGER NOT NULL DEFAULT 8,
    "stopBits" INTEGER NOT NULL DEFAULT 1,
    "parity" TEXT NOT NULL DEFAULT 'none',
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "lastData" TEXT DEFAULT '',
    "portName" TEXT DEFAULT '',
    "userIdentifier" TEXT NOT NULL DEFAULT 'default',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SerialConnection" ("baudRate", "connected", "createdAt", "dataBits", "id", "lastData", "parity", "stopBits", "updatedAt") SELECT "baudRate", "connected", "createdAt", "dataBits", "id", "lastData", "parity", "stopBits", "updatedAt" FROM "SerialConnection";
DROP TABLE "SerialConnection";
ALTER TABLE "new_SerialConnection" RENAME TO "SerialConnection";
CREATE INDEX "SerialConnection_userIdentifier_idx" ON "SerialConnection"("userIdentifier");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
