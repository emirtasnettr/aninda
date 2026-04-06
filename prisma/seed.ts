import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  Role,
  CourierType,
  CourierWorkflowStatus,
  ErpCustomerType,
  OrderStatus,
  AccountTransactionType,
  CourierEarningStatus,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL tanımlı değil (.env)');
}

const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

const SEED_PASSWORD = 'Admin123!';

const seedUsers: { email: string; role: Role }[] = [
  { email: 'admin@teslimatjet.local', role: Role.ADMIN },
  { email: 'ops.manager@teslimatjet.local', role: Role.OPERATIONS_MANAGER },
  { email: 'ops.specialist@teslimatjet.local', role: Role.OPERATIONS_SPECIALIST },
  { email: 'accounting@teslimatjet.local', role: Role.ACCOUNTING_SPECIALIST },
  { email: 'corporate@teslimatjet.local', role: Role.CORPORATE_CUSTOMER },
  { email: 'customer@teslimatjet.local', role: Role.INDIVIDUAL_CUSTOMER },
  { email: 'courier@teslimatjet.local', role: Role.COURIER },
];

/** Tekrar seed: önceki demo sipariş/işlemleri temizlenir */
const DEMO_CUSTOMER_EMAILS = [
  'demo.musteri.bireysel@teslimatjet.local',
  'demo.musteri.kurumsal@teslimatjet.local',
  'demo.musteri.kurumsal2@teslimatjet.local',
] as const;

const DEMO_COURIER_COUNT = 50;
const DEMO_ORDER_COUNT = 75;

function demoCourierEmail(i: number): string {
  return `demo.kurye.${i}@teslimatjet.local`;
}

/** Ana seed kuryesi (courier@) — panel ve mobil */
const LEGACY_SEED_COURIER_FULL_NAME = 'Oğuzhan Tekin';

/** demo.kurye.1 … demo.kurye.N ile aynı sırada (DEMO_COURIER_COUNT adet) */
const DEMO_COURIER_FULL_NAMES: string[] = [
  'Mehmet Yılmaz',
  'Ayşe Kaya',
  'Mustafa Şahin',
  'Fatma Öztürk',
  'Ahmet Aydın',
  'Zeynep Arslan',
  'Ali Doğan',
  'Elif Koç',
  'Hüseyin Polat',
  'Merve Yıldız',
  'Emre Kurt',
  'Selin Erdoğan',
  'Burak Aslan',
  'Deniz Çetin',
  'Can Özdemir',
  'Buse Tekin',
  'Kerem Şen',
  'Gizem Karaca',
  'Onur Açıkgöz',
  'Seda Yavuz',
  'Serkan Güneş',
  'Pınar Kara',
  'Tolga Bulut',
  'Esra Mutlu',
  'Barış Taş',
  'Ceren Aksoy',
  'Volkan Ersoy',
  'Derya Işık',
  'Murat Keskin',
  'Gamze Çınar',
  'Okan Yücel',
  'Burcu Şimşek',
  'Uğur Kaplan',
  'Hande Özer',
  'Cem Özkan',
  'Tuğba Ermiş',
  'Kaan Solmaz',
  'Ebru Özgür',
  'Berkant Kılıç',
  'Nazlı Turan',
  'Yiğit Altun',
  'İrem Sarı',
  'Serhat Duman',
  'Pelin Acar',
  'Arda Güler',
  'Melis Toprak',
  'Furkan Eren',
  'Beste Gönül',
  'Engin Başar',
  'Sibel Aktürk',
];

if (DEMO_COURIER_FULL_NAMES.length !== DEMO_COURIER_COUNT) {
  throw new Error(
    `DEMO_COURIER_FULL_NAMES uzunluğu ${DEMO_COURIER_FULL_NAMES.length}, beklenen ${DEMO_COURIER_COUNT}`,
  );
}

const SEED_CUSTOMER_NAME_BY_EMAIL: Record<string, string> = {
  'corporate@teslimatjet.local': 'Boğaziçi Perakende ve Dağıtım A.Ş.',
  'customer@teslimatjet.local': 'Hasan Demirtaş',
};

// İstanbul — yakın noktalar (legacy örnekler)
const LOC = {
  taksim: { lat: 41.0369, lng: 28.985 },
  kadikoy: { lat: 41.0092, lng: 29.019 },
  besiktas: { lat: 41.0422, lng: 29.008 },
  sisli: { lat: 41.0608, lng: 28.987 },
  uskudar: { lat: 41.022_52, lng: 29.015_12 },
} as const;

/** Pickup / teslimat için çeşitli semt koordinatları */
const ISTANBUL_HUBS: { lat: number; lng: number }[] = [
  { lat: LOC.taksim.lat, lng: LOC.taksim.lng },
  { lat: LOC.kadikoy.lat, lng: LOC.kadikoy.lng },
  { lat: LOC.besiktas.lat, lng: LOC.besiktas.lng },
  { lat: LOC.sisli.lat, lng: LOC.sisli.lng },
  { lat: LOC.uskudar.lat, lng: LOC.uskudar.lng },
  { lat: 41.008_583, lng: 28.980_175 },
  { lat: 41.013_84, lng: 28.949_66 },
  { lat: 41.005_46, lng: 28.976_89 },
  { lat: 41.073_12, lng: 29.013_49 },
  { lat: 40.992_3, lng: 29.024_4 },
  { lat: 41.016_5, lng: 29.114_8 },
  { lat: 41.080_71, lng: 29.021_35 },
  { lat: 41.002_7, lng: 28.978_4 },
  { lat: 41.034_4, lng: 28.977_4 },
  { lat: 40.987_9, lng: 29.036_1 },
  { lat: 41.035_1, lng: 29.102_6 },
  { lat: 41.091_2, lng: 29.007_2 },
  { lat: 41.028_1, lng: 28.853_9 },
  { lat: 40.981_9, lng: 29.116_4 },
  { lat: 41.044_4, lng: 28.894_4 },
  { lat: 41.121_9, lng: 29.052_2 },
  { lat: 41.047_8, lng: 28.784_8 },
  { lat: 41.05_12, lng: 28.944_88 },
  { lat: 40.965_9, lng: 29.081_4 },
  { lat: 41.112_2, lng: 29.02_14 },
];

function hubAt(index: number, salt: number): { lat: number; lng: number } {
  const h = ISTANBUL_HUBS[index % ISTANBUL_HUBS.length];
  const j = ((salt * 13) % 50) * 0.000_12;
  return { lat: h.lat + j, lng: h.lng + j * 0.85 };
}

async function getDemoCourierIdsInOrder(): Promise<string[]> {
  const emails = Array.from({ length: DEMO_COURIER_COUNT }, (_, k) => demoCourierEmail(k + 1));
  const couriers = await prisma.courier.findMany({
    where: { user: { email: { in: emails } } },
    select: { id: true, user: { select: { email: true } } },
  });
  const byEmail = new Map(couriers.map((c) => [c.user.email, c.id]));
  return emails.map((e) => {
    const id = byEmail.get(e);
    if (!id) throw new Error(`Demo kurye bulunamadı: ${e}`);
    return id;
  });
}

function earningAmount(price: Prisma.Decimal): Prisma.Decimal {
  const ratio = Number(process.env.COURIER_EARNING_RATIO ?? '0.72');
  const v = Math.round(Number(price) * ratio * 100) / 100;
  return new Prisma.Decimal(v);
}

function orderCommissionSnapshot(priceDec: Prisma.Decimal) {
  const ratio = Number(process.env.COURIER_EARNING_RATIO ?? '0.72');
  const earning = earningAmount(priceDec);
  const commission = new Prisma.Decimal(
    Math.round((Number(priceDec) - Number(earning)) * 100) / 100,
  );
  return {
    courierSharePercent: new Prisma.Decimal(ratio),
    courierEarningAmount: earning,
    platformCommissionAmount: commission,
  };
}

async function wipeDemoCommerce() {
  const demoCustomers = await prisma.customer.findMany({
    where: { email: { in: [...DEMO_CUSTOMER_EMAILS] } },
    select: { id: true, userId: true },
  });
  if (demoCustomers.length === 0) return;

  const customerUserIds = demoCustomers.map((c) => c.userId);
  const customerCrmIds = demoCustomers.map((c) => c.id);

  await prisma.order.deleteMany({
    where: { customerId: { in: customerUserIds } },
  });

  await prisma.customerTransaction.deleteMany({
    where: { customerId: { in: customerCrmIds } },
  });

  await prisma.customerAccount.updateMany({
    where: { customerId: { in: customerCrmIds } },
    data: { balance: new Prisma.Decimal(0) },
  });

  console.log('Demo müşteri sipariş ve cari hareketleri sıfırlandı.');
}

async function applyCustomerTx(
  customerCrmId: string,
  type: AccountTransactionType,
  amount: Prisma.Decimal,
  description: string,
  createdAt: Date,
) {
  await prisma.customerTransaction.create({
    data: {
      customerId: customerCrmId,
      type,
      amount,
      description,
      createdAt,
    },
  });
  const delta =
    type === AccountTransactionType.DEBIT ? amount : amount.negated();
  await prisma.customerAccount.update({
    where: { customerId: customerCrmId },
    data: { balance: { increment: delta } },
  });
}

async function seedDemoUsers(passwordHash: string) {
  for (let i = 1; i <= DEMO_COURIER_COUNT; i++) {
    const email = demoCourierEmail(i);
    await prisma.user.upsert({
      where: { email },
      update: { password: passwordHash, role: Role.COURIER },
      create: { email, password: passwordHash, role: Role.COURIER },
    });
  }

  await prisma.user.upsert({
    where: { email: DEMO_CUSTOMER_EMAILS[0] },
    update: { password: passwordHash, role: Role.INDIVIDUAL_CUSTOMER },
    create: {
      email: DEMO_CUSTOMER_EMAILS[0],
      password: passwordHash,
      role: Role.INDIVIDUAL_CUSTOMER,
    },
  });

  for (const email of [DEMO_CUSTOMER_EMAILS[1], DEMO_CUSTOMER_EMAILS[2]]) {
    await prisma.user.upsert({
      where: { email },
      update: { password: passwordHash, role: Role.CORPORATE_CUSTOMER },
      create: { email, password: passwordHash, role: Role.CORPORATE_CUSTOMER },
    });
  }
}

async function seedDemoCouriers() {
  for (let i = 1; i <= DEMO_COURIER_COUNT; i++) {
    const email = demoCourierEmail(i);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const pos = hubAt(i - 1, i * 3);
    const type = i % 2 === 0 ? CourierType.CAR : CourierType.MOTORCYCLE;
    const isOnline = i % 5 !== 0;

    await prisma.courier.upsert({
      where: { userId: user.id },
      update: {
        fullName: DEMO_COURIER_FULL_NAMES[i - 1],
        type,
        isOnline,
        lat: pos.lat,
        lng: pos.lng,
        workflowStatus: CourierWorkflowStatus.APPROVED,
      },
      create: {
        userId: user.id,
        fullName: DEMO_COURIER_FULL_NAMES[i - 1],
        type,
        isOnline,
        lat: pos.lat,
        lng: pos.lng,
        workflowStatus: CourierWorkflowStatus.APPROVED,
      },
    });
  }
  console.log(`${DEMO_COURIER_COUNT} demo kurye profili.`);
}

async function seedDemoCustomers() {
  const bireyselUser = await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_CUSTOMER_EMAILS[0] },
  });
  const kurumsalUser = await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_CUSTOMER_EMAILS[1] },
  });
  const kurumsal2User = await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_CUSTOMER_EMAILS[2] },
  });

  const bireysel = await prisma.customer.upsert({
    where: { userId: bireyselUser.id },
    update: {
      name: 'Zehra Koç',
      phone: '+90 532 401 01 01',
      address: 'Caferağa Mah. Moda Cad. No:12, Kadıköy / İstanbul',
    },
    create: {
      userId: bireyselUser.id,
      name: 'Zehra Koç',
      email: DEMO_CUSTOMER_EMAILS[0],
      type: ErpCustomerType.INDIVIDUAL,
      phone: '+90 532 401 01 01',
      address: 'Caferağa Mah. Moda Cad. No:12, Kadıköy / İstanbul',
    },
  });

  const kurumsal = await prisma.customer.upsert({
    where: { userId: kurumsalUser.id },
    update: {
      name: 'Anadolu Lojistik Sanayi ve Ticaret Ltd. Şti.',
      creditEnabled: true,
      creditLimit: new Prisma.Decimal(50_000),
      taxNumber: '1234567890',
      phone: '+90 216 502 02 02',
      address: 'İçerenköy Yolu Üzeri Lojistik Sitesi A Blok, Ataşehir / İstanbul',
    },
    create: {
      userId: kurumsalUser.id,
      name: 'Anadolu Lojistik Sanayi ve Ticaret Ltd. Şti.',
      email: DEMO_CUSTOMER_EMAILS[1],
      type: ErpCustomerType.CORPORATE,
      creditEnabled: true,
      creditLimit: new Prisma.Decimal(50_000),
      taxNumber: '1234567890',
      phone: '+90 216 502 02 02',
      address: 'İçerenköy Yolu Üzeri Lojistik Sitesi A Blok, Ataşehir / İstanbul',
    },
  });

  const kurumsal2 = await prisma.customer.upsert({
    where: { userId: kurumsal2User.id },
    update: {
      name: 'Marmara Market Gıda Pazarlama A.Ş.',
      creditEnabled: true,
      creditLimit: new Prisma.Decimal(100_000),
      taxNumber: '9876543210',
      phone: '+90 212 503 03 03',
      address: 'Maslak Mah. Büyükdere Cad. İş Merkezi No:255, Sarıyer / İstanbul',
    },
    create: {
      userId: kurumsal2User.id,
      name: 'Marmara Market Gıda Pazarlama A.Ş.',
      email: DEMO_CUSTOMER_EMAILS[2],
      type: ErpCustomerType.CORPORATE,
      creditEnabled: true,
      creditLimit: new Prisma.Decimal(100_000),
      taxNumber: '9876543210',
      phone: '+90 212 503 03 03',
      address: 'Maslak Mah. Büyükdere Cad. İş Merkezi No:255, Sarıyer / İstanbul',
    },
  });

  for (const cid of [bireysel.id, kurumsal.id, kurumsal2.id]) {
    await prisma.customerAccount.upsert({
      where: { customerId: cid },
      update: {},
      create: { customerId: cid, balance: 0 },
    });
  }

  return { bireysel, kurumsal, kurumsal2, bireyselUser, kurumsalUser, kurumsal2User };
}

async function seedDemoOrdersAndFinance(ctx: Awaited<ReturnType<typeof seedDemoCustomers>>) {
  const courierIds = await getDemoCourierIdsInOrder();

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const min = 60 * 1000;

  type Slot = { userId: string; crmId: string };
  const slots: Slot[] = [
    { userId: ctx.bireyselUser.id, crmId: ctx.bireysel.id },
    { userId: ctx.kurumsalUser.id, crmId: ctx.kurumsal.id },
    { userId: ctx.kurumsal2User.id, crmId: ctx.kurumsal2.id },
  ];

  type OrderSeed = {
    customerUserId: string;
    customerCrmId: string;
    status: OrderStatus;
    price: number;
    createdAt: Date;
    courierId?: string;
    label: string;
    pickupIdx: number;
    deliveryIdx: number;
  };

  const orders: OrderSeed[] = [];
  let seq = 0;

  const pushBatch = (
    count: number,
    status: OrderStatus,
    baseCreated: Date,
    assignCourier: boolean,
  ) => {
    for (let j = 0; j < count; j++) {
      const slot = slots[seq % slots.length];
      const price = 48 + ((seq * 73) % 412);
      const createdAt = new Date(baseCreated.getTime() + j * 4000);
      const cid = assignCourier ? courierIds[seq % courierIds.length] : undefined;
      const pickupIdx = (seq * 3) % ISTANBUL_HUBS.length;
      let deliveryIdx = (seq * 5 + 3) % ISTANBUL_HUBS.length;
      if (deliveryIdx === pickupIdx) deliveryIdx = (deliveryIdx + 1) % ISTANBUL_HUBS.length;

      orders.push({
        customerUserId: slot.userId,
        customerCrmId: slot.crmId,
        status,
        price,
        createdAt,
        courierId: cid,
        label: `demo_bulk_${seq}`,
        pickupIdx,
        deliveryIdx,
      });
      seq++;
    }
  };

  // Gecikmiş / SLA riski (eski createdAt)
  pushBatch(7, OrderStatus.PENDING, new Date(now - 2.5 * hour), false);
  pushBatch(7, OrderStatus.SEARCHING_COURIER, new Date(now - 100 * min), false);
  pushBatch(6, OrderStatus.ACCEPTED, new Date(now - 95 * min), true);
  pushBatch(5, OrderStatus.PICKED_UP, new Date(now - 88 * min), true);
  // Güncel bekleyen / atama
  pushBatch(10, OrderStatus.PENDING, new Date(now - 11 * min), false);
  pushBatch(12, OrderStatus.SEARCHING_COURIER, new Date(now - 7 * min), false);
  // Kuryeli aktif
  pushBatch(10, OrderStatus.ACCEPTED, new Date(now - 14 * min), true);
  pushBatch(9, OrderStatus.PICKED_UP, new Date(now - 21 * min), true);
  pushBatch(9, OrderStatus.ON_DELIVERY, new Date(now - 17 * min), true);

  if (orders.length !== DEMO_ORDER_COUNT) {
    throw new Error(`Demo sipariş sayısı ${orders.length}, beklenen ${DEMO_ORDER_COUNT}`);
  }

  let tOffset = 0;
  for (const o of orders) {
    const priceDec = new Prisma.Decimal(o.price);
    const salt = tOffset;
    const pu = hubAt(o.pickupIdx, salt);
    const del = hubAt(o.deliveryIdx, salt + 17);
    await prisma.order.create({
      data: {
        customerId: o.customerUserId,
        courierId: o.courierId ?? null,
        status: o.status,
        pickupLat: pu.lat,
        pickupLng: pu.lng,
        deliveryLat: del.lat,
        deliveryLng: del.lng,
        price: priceDec,
        createdAt: o.createdAt,
        deliveredAt: null,
        ...orderCommissionSnapshot(priceDec),
      },
    });

    const txTime = new Date(o.createdAt.getTime() + tOffset++);
    await applyCustomerTx(
      o.customerCrmId,
      AccountTransactionType.DEBIT,
      priceDec,
      `Sipariş borç kaydı (${o.label})`,
      txTime,
    );
  }

  // Ek cari hareketler: tahsilatlar (alacak) ve ek borç
  const tBase = new Date(now - 10 * day);

  await applyCustomerTx(
    ctx.bireysel.id,
    AccountTransactionType.CREDIT,
    new Prisma.Decimal(5000),
    'Ön ödeme / tahsilat (demo)',
    new Date(tBase.getTime() + 1 * hour),
  );

  await applyCustomerTx(
    ctx.bireysel.id,
    AccountTransactionType.CREDIT,
    new Prisma.Decimal(800),
    'Kısmi tahsilat (demo)',
    new Date(now - 1 * day),
  );

  await applyCustomerTx(
    ctx.kurumsal.id,
    AccountTransactionType.CREDIT,
    new Prisma.Decimal(2500),
    'Havale tahsilatı (demo)',
    new Date(tBase.getTime() + 2 * hour),
  );

  await applyCustomerTx(
    ctx.kurumsal.id,
    AccountTransactionType.DEBIT,
    new Prisma.Decimal(44_200),
    'Devreden / toplu borç bakiyesi (demo — limite yakın)',
    new Date(tBase.getTime() + 30 * 60 * 1000),
  );

  await applyCustomerTx(
    ctx.kurumsal.id,
    AccountTransactionType.DEBIT,
    new Prisma.Decimal(350),
    'Manuel borç — ek hizmet (demo)',
    new Date(now - 3 * day),
  );

  await applyCustomerTx(
    ctx.kurumsal.id,
    AccountTransactionType.DEBIT,
    new Prisma.Decimal(8200),
    'Senaryo: limit aşımı (demo — panelde kırmızı risk)',
    new Date(now - 2 * hour),
  );

  await applyCustomerTx(
    ctx.kurumsal2.id,
    AccountTransactionType.CREDIT,
    new Prisma.Decimal(2500),
    'Tahsilat (demo)',
    new Date(tBase.getTime() + 3 * hour),
  );

  await applyCustomerTx(
    ctx.kurumsal2.id,
    AccountTransactionType.DEBIT,
    new Prisma.Decimal(120),
    'Düzeltme borç kaydı (demo)',
    new Date(now - 12 * hour),
  );

  console.log(
    `${orders.length} demo sipariş (DELIVERED yok) + cari hareketler; demo kurye hakedişi oluşturulmadı.`,
  );
}

/** Var olan corporate@ / customer@ için birkaç sipariş (idempotent: aynı açıklama ile tx yoksa) */
async function seedLegacyUserSamples() {
  const corporate = await prisma.user.findUnique({
    where: { email: 'corporate@teslimatjet.local' },
  });
  const customer = await prisma.user.findUnique({
    where: { email: 'customer@teslimatjet.local' },
  });
  if (!corporate || !customer) return;

  const corpCust = await prisma.customer.findUnique({
    where: { userId: corporate.id },
  });
  const indCust = await prisma.customer.findUnique({
    where: { userId: customer.id },
  });
  if (!corpCust || !indCust) return;

  const courier = await prisma.courier.findFirst({
    where: { user: { email: 'courier@teslimatjet.local' } },
  });
  if (!courier) return;

  const existingInd = await prisma.order.findFirst({
    where: {
      customerId: customer.id,
      status: OrderStatus.DELIVERED,
      price: new Prisma.Decimal(99.99),
    },
  });
  const existingCorp = await prisma.order.findFirst({
    where: {
      customerId: corporate.id,
      status: OrderStatus.SEARCHING_COURIER,
      price: new Prisma.Decimal(156),
    },
  });
  if (existingInd && existingCorp) {
    console.log('Legacy demo siparişleri zaten mevcut, atlanıyor.');
    return;
  }

  const price1 = new Prisma.Decimal(99.99);
  const o1 =
    existingInd ??
    (await prisma.order.create({
      data: {
        customerId: customer.id,
        courierId: courier.id,
        status: OrderStatus.DELIVERED,
        pickupLat: LOC.taksim.lat,
        pickupLng: LOC.taksim.lng,
        deliveryLat: LOC.besiktas.lat,
        deliveryLng: LOC.besiktas.lng,
        price: price1,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        deliveredAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 3600000),
        ...orderCommissionSnapshot(price1),
      },
    }));
  if (!existingInd) {
    await applyCustomerTx(
      indCust.id,
      AccountTransactionType.DEBIT,
      price1,
      'Sipariş borç kaydı (seed legacy)',
      o1.createdAt,
    );
    await prisma.courierEarning.create({
      data: {
        courierId: courier.id,
        orderId: o1.id,
        amount: earningAmount(price1),
        status: CourierEarningStatus.PAID,
      },
    });
  }

  const price2 = new Prisma.Decimal(156);
  const o2 =
    existingCorp ??
    (await prisma.order.create({
      data: {
        customerId: corporate.id,
        status: OrderStatus.SEARCHING_COURIER,
        pickupLat: LOC.kadikoy.lat,
        pickupLng: LOC.kadikoy.lng,
        deliveryLat: LOC.uskudar.lat,
        deliveryLng: LOC.uskudar.lng,
        price: price2,
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
        ...orderCommissionSnapshot(price2),
      },
    }));
  if (!existingCorp) {
    await applyCustomerTx(
      corpCust.id,
      AccountTransactionType.DEBIT,
      price2,
      'Sipariş borç kaydı (seed legacy)',
      o2.createdAt,
    );
  }

  console.log('corporate@ / customer@ için örnek siparişler kontrol edildi / eklendi.');
}

/** Mevcut Order kayıtlarından CourierPerformance + dispatchScore senkronu (seed sonrası) */
async function backfillAllCourierPerformance() {
  const couriers = await prisma.courier.findMany({ select: { id: true } });
  for (const { id: courierId } of couriers) {
    const delivered = await prisma.order.findMany({
      where: {
        courierId,
        status: OrderStatus.DELIVERED,
        deliveredAt: { not: null },
      },
      select: { createdAt: true, deliveredAt: true },
    });
    const cancelled = await prisma.order.count({
      where: { courierId, status: OrderStatus.CANCELLED },
    });
    let sumMins = 0;
    let nMins = 0;
    for (const o of delivered) {
      if (!o.deliveredAt) continue;
      const m = (o.deliveredAt.getTime() - o.createdAt.getTime()) / 60_000;
      if (Number.isFinite(m) && m >= 0 && m < 72 * 60) {
        sumMins += m;
        nMins += 1;
      }
    }
    const succ = delivered.length;
    const total = succ + cancelled;
    const avg =
      nMins > 0 ? new Prisma.Decimal(sumMins / nMins) : null;

    await prisma.courierPerformance.upsert({
      where: { courierId },
      create: {
        courierId,
        totalDeliveries: total,
        successfulDeliveries: succ,
        cancelledDeliveries: cancelled,
        averageDeliveryTimeMinutes: avg,
      },
      update: {
        totalDeliveries: total,
        successfulDeliveries: succ,
        cancelledDeliveries: cancelled,
        averageDeliveryTimeMinutes: avg,
      },
    });

    const c = await prisma.courier.findUnique({
      where: { id: courierId },
      include: { performance: true },
    });
    if (!c) continue;
    const totalClosed =
      (c.performance?.successfulDeliveries ?? 0) +
      (c.performance?.cancelledDeliveries ?? 0);
    const successRate =
      totalClosed > 0
        ? (c.performance!.successfulDeliveries / totalClosed)
        : 0.5;
    const ratingPoints =
      c.totalRatings > 0 && c.averageRating != null
        ? ((Number(c.averageRating) - 1) / 4) * 40
        : 20;
    const successPoints = successRate * 30;
    let speedPoints = 10;
    if (c.performance?.averageDeliveryTimeMinutes != null) {
      const mm = Number(c.performance.averageDeliveryTimeMinutes);
      speedPoints = Math.max(
        0,
        Math.min(20, 20 * (1 - Math.max(0, mm - 25) / 65)),
      );
    }
    let activityPoints = 0;
    if (c.performance?.lastActiveAt) {
      const hours =
        (Date.now() - c.performance.lastActiveAt.getTime()) / 3_600_000;
      if (hours <= 24) activityPoints = 10;
      else if (hours <= 168) activityPoints = 5;
    }
    const score = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          (ratingPoints + successPoints + speedPoints + activityPoints) * 100,
        ) / 100,
      ),
    );
    await prisma.courier.update({
      where: { id: courierId },
      data: { dispatchScore: new Prisma.Decimal(score) },
    });
  }
  console.log('Kurye performans metrikleri Order tablosundan senkronlandı.');
}

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  for (const { email, role } of seedUsers) {
    await prisma.user.upsert({
      where: { email },
      update: { password: passwordHash, role },
      create: { email, password: passwordHash, role },
    });
  }

  const courierUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'courier@teslimatjet.local' },
  });

  await prisma.courier.upsert({
    where: { userId: courierUser.id },
    update: {
      fullName: LEGACY_SEED_COURIER_FULL_NAME,
      workflowStatus: CourierWorkflowStatus.APPROVED,
    },
    create: {
      userId: courierUser.id,
      fullName: LEGACY_SEED_COURIER_FULL_NAME,
      type: CourierType.MOTORCYCLE,
      isOnline: true,
      lat: 41.0082,
      lng: 28.9784,
      workflowStatus: CourierWorkflowStatus.APPROVED,
    },
  });

  const globalRule = await prisma.pricingRule.findFirst({
    where: { customerId: null },
  });
  if (!globalRule) {
    await prisma.pricingRule.create({
      data: {
        basePrice: 35,
        perKmPrice: 12,
      },
    });
    console.log('Varsayılan fiyat kuralı oluşturuldu (35 + 12/km).');
  }

  const customerUsers = await prisma.user.findMany({
    where: {
      role: { in: [Role.INDIVIDUAL_CUSTOMER, Role.CORPORATE_CUSTOMER] },
    },
  });
  for (const u of customerUsers) {
    const existing = await prisma.customer.findUnique({
      where: { userId: u.id },
    });
    if (existing) continue;
    const customer = await prisma.customer.create({
      data: {
        userId: u.id,
        name:
          SEED_CUSTOMER_NAME_BY_EMAIL[u.email] ??
          (u.email.split('@')[0] ?? 'müşteri'),
        email: u.email,
        type:
          u.role === Role.CORPORATE_CUSTOMER
            ? ErpCustomerType.CORPORATE
            : ErpCustomerType.INDIVIDUAL,
      },
    });
    await prisma.customerAccount.create({
      data: {
        customerId: customer.id,
        balance: 0,
      },
    });
    console.log(`CRM müşteri kartı: ${u.email}`);
  }

  await seedDemoUsers(passwordHash);
  await seedDemoCouriers();
  const demoCtx = await seedDemoCustomers();
  await wipeDemoCommerce();
  await seedDemoOrdersAndFinance(demoCtx);
  await seedLegacyUserSamples();
  await backfillAllCourierPerformance();

  for (const [email, name] of Object.entries(SEED_CUSTOMER_NAME_BY_EMAIL)) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) continue;
    await prisma.customer.updateMany({
      where: { userId: u.id },
      data: { name },
    });
  }

  await prisma.systemSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', appName: 'Teslimatjet' },
    update: {},
  });

  console.log(
    'Seed OK:',
    seedUsers.map((u) => `${u.role}:${u.email}`).join(', '),
  );
  console.log(`Tüm tohum kullanıcıların şifresi: ${SEED_PASSWORD}`);
  console.log('');
  console.log('--- Demo test hesapları (aynı şifre) ---');
  console.log(`Kuryeler: ${demoCourierEmail(1)} … ${demoCourierEmail(DEMO_COURIER_COUNT)}`);
  console.log('Müşteriler:', DEMO_CUSTOMER_EMAILS.join(', '));
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
