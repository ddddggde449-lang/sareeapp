import express from "express";
import { db } from "../db.js";
import * as schema from "../../shared/schema.js";
import { eq, desc, and } from "drizzle-orm";

const router = express.Router();

// تسجيل عميل جديد أو تسجيل الدخول
router.post("/auth", async (req, res) => {
  try {
    const { phone, name } = req.body;

    // البحث عن العميل
    let customer = await db.query.customers.findFirst({
      where: eq(schema.customers.phone, phone)
    });

    if (!customer) {
      // إنشاء عميل جديد
      [customer] = await db.insert(schema.customers)
        .values({ phone, name })
        .returning();
    }

    res.json(customer);
  } catch (error) {
    console.error("خطأ في مصادقة العميل:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب ملف العميل
router.get("/:id/profile", async (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.id, id)
    });

    if (!customer) {
      return res.status(404).json({ error: "العميل غير موجود" });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تحديث ملف العميل
router.put("/:id/profile", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const [updatedCustomer] = await db.update(schema.customers)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(schema.customers.id, id))
      .returning();

    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب عناوين العميل
router.get("/:id/addresses", async (req, res) => {
  try {
    const { id } = req.params;
    
    const addresses = await db.query.customerAddresses.findMany({
      where: eq(schema.customerAddresses.customerId, id),
      orderBy: [desc(schema.customerAddresses.isDefault), desc(schema.customerAddresses.createdAt)]
    });

    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إضافة عنوان جديد
router.post("/:id/addresses", async (req, res) => {
  try {
    const { id } = req.params;
    const addressData = { ...req.body, customerId: id };

    // إذا كان العنوان افتراضي، إلغاء الافتراضي من العناوين الأخرى
    if (addressData.isDefault) {
      await db.update(schema.customerAddresses)
        .set({ isDefault: false })
        .where(eq(schema.customerAddresses.customerId, id));
    }

    const [newAddress] = await db.insert(schema.customerAddresses)
      .values(addressData)
      .returning();

    res.json(newAddress);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تحديث عنوان
router.put("/:customerId/addresses/:addressId", async (req, res) => {
  try {
    const { customerId, addressId } = req.params;
    const updateData = req.body;

    // إذا كان العنوان افتراضي، إلغاء الافتراضي من العناوين الأخرى
    if (updateData.isDefault) {
      await db.update(schema.customerAddresses)
        .set({ isDefault: false })
        .where(eq(schema.customerAddresses.customerId, customerId));
    }

    const [updatedAddress] = await db.update(schema.customerAddresses)
      .set(updateData)
      .where(and(
        eq(schema.customerAddresses.id, addressId),
        eq(schema.customerAddresses.customerId, customerId)
      ))
      .returning();

    res.json(updatedAddress);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// حذف عنوان
router.delete("/:customerId/addresses/:addressId", async (req, res) => {
  try {
    const { customerId, addressId } = req.params;

    await db.delete(schema.customerAddresses)
      .where(and(
        eq(schema.customerAddresses.id, addressId),
        eq(schema.customerAddresses.customerId, customerId)
      ));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب طلبات العميل
router.get("/:id/orders", async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const orders = await db.query.orders.findMany({
      where: eq(schema.orders.customerId, id),
      with: {
        restaurantId: true,
        driverId: true
      },
      limit: Number(limit),
      offset,
      orderBy: desc(schema.orders.createdAt)
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تقييم طلب
router.post("/orders/:orderId/review", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { customerId, rating, comment, foodQuality, deliverySpeed, packaging, driverService } = req.body;

    // تحديث تقييم الطلب
    await db.update(schema.orders)
      .set({ rating, review: comment })
      .where(eq(schema.orders.id, orderId));

    // إضافة مراجعة مفصلة
    const [newReview] = await db.insert(schema.reviews)
      .values({
        customerId,
        orderId,
        rating,
        comment,
        foodQuality,
        deliverySpeed,
        packaging,
        driverService
      })
      .returning();

    res.json(newReview);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export { router as customerRoutes };