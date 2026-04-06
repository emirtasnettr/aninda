#!/usr/bin/env node
/**
 * Müşteri hesabıyla POST /orders — kurye eşleştirmesi ve teklifler çalışır.
 * Önkoşul: Nest API çalışıyor, `npx prisma db seed` yapılmış (müşteri + çevrimiçi kurye).
 *
 * Kullanım:
 *   node scripts/create-test-order.mjs
 *   API_URL=http://127.0.0.1:3000 node scripts/create-test-order.mjs
 */

const base = (process.env.API_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

const CUSTOMER = {
  email: process.env.TEST_CUSTOMER_EMAIL || "customer@teslimatjet.local",
  password: process.env.TEST_CUSTOMER_PASSWORD || "Admin123!",
};

// İstanbul içi örnek koordinatlar (Taksim → Kadıköy yakını)
const coords = {
  pickupLat: 41.0369,
  pickupLng: 28.985,
  deliveryLat: 41.0082,
  deliveryLng: 29.03,
};

async function main() {
  const loginRes = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CUSTOMER),
  });
  const loginText = await loginRes.text();
  let loginJson;
  try {
    loginJson = JSON.parse(loginText);
  } catch {
    console.error("Giriş yanıtı JSON değil:", loginText.slice(0, 200));
    process.exit(1);
  }
  if (!loginRes.ok) {
    console.error("Giriş başarısız:", loginJson);
    process.exit(1);
  }
  const token = loginJson.accessToken;
  if (!token) {
    console.error("Token yok:", loginJson);
    process.exit(1);
  }

  const quoteParams = new URLSearchParams({
    pickupLat: String(coords.pickupLat),
    pickupLng: String(coords.pickupLng),
    deliveryLat: String(coords.deliveryLat),
    deliveryLng: String(coords.deliveryLng),
  });
  const quoteRes = await fetch(`${base}/pricing/me-quote?${quoteParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const quoteText = await quoteRes.text();
  let quoteJson;
  try {
    quoteJson = JSON.parse(quoteText);
  } catch {
    console.error("Fiyat yanıtı JSON değil:", quoteText.slice(0, 300));
    process.exit(1);
  }
  if (!quoteRes.ok) {
    console.error("Fiyat alınamadı:", quoteRes.status, quoteJson);
    process.exit(1);
  }

  const body = {
    ...coords,
    price: quoteJson.total,
    priority: false,
  };

  const orderRes = await fetch(`${base}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const orderText = await orderRes.text();
  let orderJson;
  try {
    orderJson = JSON.parse(orderText);
  } catch {
    console.error("Sipariş yanıtı JSON değil:", orderText.slice(0, 300));
    process.exit(1);
  }
  if (!orderRes.ok) {
    console.error("Sipariş oluşturulamadı:", orderRes.status, orderJson);
    process.exit(1);
  }

  console.log("Sipariş oluşturuldu.");
  console.log("ID:", orderJson.id);
  console.log("Durum:", orderJson.status);
  console.log("Tutar:", String(orderJson.price));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
