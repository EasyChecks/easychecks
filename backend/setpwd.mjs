import { PrismaClient } from '/app/node_modules/@prisma/client/default.js';
const prisma = new PrismaClient();
const updates = [
  { employeeId: 'SA001', adminPassword: 'sup123' },
  { employeeId: 'BKK0001', adminPassword: 'adm456' },
  { employeeId: 'CNX0001', adminPassword: 'adm789' },
];
for (const u of updates) {
  const result = await prisma.user.update({
    where: { employeeId: u.employeeId },
    data: { adminPassword: u.adminPassword },
    select: { employeeId: true, role: true, adminPassword: true },
  });
  console.log(JSON.stringify(result));
}
await prisma.();
