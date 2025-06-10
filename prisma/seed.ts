const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Create default quick commands
  const quickCommands = [
    { label: "Version", command: "version", position: 0 },
    { label: "Help", command: "help", position: 1 },
    { label: "Status", command: "status", position: 2 },
    { label: "Reboot", command: "reboot", position: 3 },
    { label: "Reset", command: "reset", position: 4 },
    { label: "Clear", command: "clear", position: 5 },
    { label: "Read Temp", command: "read temp", position: 6 },
    { label: "Read Humidity", command: "read humidity", position: 7 },
  ];

  console.log('Seeding quick commands...');
  
  // Create all quick commands
  for (const cmd of quickCommands) {
    await prisma.quickCommand.upsert({
      where: { id: cmd.position + 1 }, // Use position+1 as ID to avoid conflicts
      update: cmd,
      create: { ...cmd, id: cmd.position + 1 },
    });
  }

  // Create initial serial connection record
  console.log('Creating default serial connection...');
  await prisma.serialConnection.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      connected: false,
    },
  });

  console.log('Seeding completed');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 