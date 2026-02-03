import { prisma as prismaInit } from "./src/lib/prisma.js";

async function getPrisma() {
  let prisma = prismaInit;
  let attempts = 0;
  while (!prisma && attempts < 10) {
    await new Promise(r => setTimeout(r, 100));
    prisma = prismaInit;
    attempts++;
  }
  return prisma;
}

async function main() {
  try {
    const prisma = await getPrisma();
    if (!prisma) throw new Error("Prisma not initialized");

    console.log("🌱 Creating seed data for today...\n");

    // Get some existing users and branch
    const users = await prisma.user.findMany({
      take: 5,
      include: {
        branch: true,
      },
    });

    if (users.length === 0) {
      console.log("❌ No users found in database!");
      return;
    }

    const branch = users[0].branch;
    console.log(`✅ Using branch: ${branch?.name}`);

    // Get or create locations
    const locations = await prisma.location.findMany({
      take: 2,
    });

    if (locations.length === 0) {
      console.log("❌ No locations found. Please create locations first!");
      return;
    }

    const location1 = locations[0];
    const location2 = locations.length > 1 ? locations[1] : location1;

    console.log(`✅ Using location: ${location1.locationName}`);

    // Create attendance records for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let createdCount = 0;

    for (let i = 0; i < users.length; i++) {
      const checkInTime = new Date(today);
      checkInTime.setHours(8 + i, 30, 0);

      // Create normal attendance
      const att1 = await prisma.attendance.create({
        data: {
          userId: users[i].userId,
          checkIn: checkInTime,
          checkInLat: 13.7563,
          checkInLng: 100.5018,
          status: i % 3 === 0 ? "LATE" : "ON_TIME",
          lateMinutes: i % 3 === 0 ? 15 : 0,
        },
      });

      console.log(
        `✅ Created attendance for ${users[i].employeeId} (${att1.status})`
      );
      createdCount++;

      // Create location-based attendance for some users (outside location)
      if (i < 2) {
        const checkInTime2 = new Date(checkInTime);
        checkInTime2.setHours(checkInTime2.getHours() + 2);

        const att2 = await prisma.attendance.create({
          data: {
            userId: users[i].userId,
            locationId: location1.locationId,
            checkIn: checkInTime2,
            checkInLat: 13.8,
            checkInLng: 100.6,
            checkInDistance: 5000, // 5km away from location
            status: "ON_TIME",
          },
        });

        console.log(
          `✅ Created location attendance for ${users[i].employeeId} (distance: 5km, outside radius)`
        );
        createdCount++;
      }
    }

    console.log(`\n✨ Created ${createdCount} attendance records for today!`);

    // Verify
    const todayAtt = await prisma.attendance.findMany({
      where: {
        checkIn: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    console.log(`✅ Verification: ${todayAtt.length} records found for today`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    // Prisma is shared, don't disconnect
  }
}

main();
