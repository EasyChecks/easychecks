import { prisma } from './src/lib/prisma';

async function main() {
  const shifts = await prisma.shift.findMany({ 
    include: { location: true },
    take: 5
  });
  console.log('Shifts:', shifts.map(s => ({ id: s.shiftId, name: s.name, userId: s.userId })));
  
  if (shifts.length > 0) {
    const userId = shifts[0].userId;
    // create dummy shift
    const newShift = await prisma.shift.create({
      data: {
        userId: userId,
        name: 'กะบ่าย (TEST 2)',
        startTime: '13:00',
        endTime: '20:00',
        gracePeriodMinutes: 15,
        lateThresholdMinutes: 60,
        isActive: true,
        locationId: shifts[0]?.locationId || null,
        createdById: userId,
      }
    });
    console.log('Created shift:', newShift.name, 'for user', userId);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
