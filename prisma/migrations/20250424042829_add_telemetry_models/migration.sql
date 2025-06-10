-- CreateTable
CREATE TABLE "BatteryData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "voltage" REAL NOT NULL,
    "percentage" REAL NOT NULL,
    "current" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TemperatureData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "voltage" REAL NOT NULL,
    "temperature" REAL NOT NULL DEFAULT 0.0,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GNSSData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "altitude" REAL NOT NULL,
    "hdop" REAL NOT NULL,
    "satellites" INTEGER NOT NULL,
    "fixType" INTEGER NOT NULL,
    "rawNMEA" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GasData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sensorType" TEXT NOT NULL,
    "sensorValue" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
