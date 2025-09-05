import express from "express";
import { db } from "../db.js";
import * as schema from "../../shared/schema.js";
import { eq, desc, and, or, like, sql } from "drizzle-orm";

const router = express.Router();

// جلب التصنيفات
router.get("/categories", async (req, res) => {
  try {
    const categories = await db.query.categories.findMany({
      where: eq(schema.categories.isActive, true),
      orderBy: [schema.categories.sortOrder, schema.categories.name]
    });
    
    res.json(categories);
  } catch (error) {
    console.error("خطأ في جلب التصنيفات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب المطاعم
router.get("/restaurants", async (req, res) => {
  try {
    const { categoryId, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(schema.restaurants.isActive, true)];
    
    if (categoryId && categoryId !== 'all') {
      whereConditions.push(eq(schema.restaurants.categoryId, categoryId as string));
    }
    
    if (search) {
      whereConditions.push(
        or(
          like(schema.restaurants.name, `%${search}%`),
          like(schema.restaurants.description, `%${search}%`)
        )
      );
    }

    const restaurants = await db.query.restaurants.findMany({
      where: and(...whereConditions),
      with: {
        categoryId: true
      },
      limit: Number(limit),
      offset,
      orderBy: [desc(schema.restaurants.rating), schema.restaurants.name]
    });

    res.json(restaurants);
  } catch (error) {
    console.error("خطأ في جلب المطاعم:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب تفاصيل مطعم محدد
router.get("/restaurants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const restaurant = await db.query.restaurants.findFirst({
      where: and(
        eq(schema.restaurants.id, id),
        eq(schema.restaurants.isActive, true)
      ),
      with: {
        categoryId: true
      }
    });

    if (!restaurant) {
      return res.status(404).json({ error: "المطعم غير موجود" });
    }

    res.json(restaurant);
  } catch (error) {
    console.error("خطأ في جلب تفاصيل المطعم:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب قائمة مطعم
router.get("/restaurants/:id/menu", async (req, res) => {
  try {
    const { id } = req.params;
    
    // التحقق من وجود المطعم
    const restaurant = await db.query.restaurants.findFirst({
      where: and(
        eq(schema.restaurants.id, id),
        eq(schema.restaurants.isActive, true)
      )
    });

    if (!restaurant) {
      return res.status(404).json({ error: "المطعم غير موجود" });
    }

    // جلب عناصر القائمة مع الأقسام
    const menuItems = await db.query.menuItems.findMany({
      where: and(
        eq(schema.menuItems.restaurantId, id),
        eq(schema.menuItems.isAvailable, true)
      ),
      with: {
        sectionId: true
      },
      orderBy: [schema.menuItems.sortOrder, schema.menuItems.name]
    });

    // تجميع العناصر حسب القسم
    const sections = await db.query.restaurantSections.findMany({
      where: eq(schema.restaurantSections.isActive, true),
      orderBy: [schema.restaurantSections.sortOrder, schema.restaurantSections.name]
    });

    const menuBySection = sections.map(section => ({
      ...section,
      items: menuItems.filter(item => item.sectionId === section.id)
    })).filter(section => section.items.length > 0);

    res.json({
      restaurant,
      menu: menuBySection,
      allItems: menuItems
    });
  } catch (error) {
    console.error("خطأ في جلب قائمة المطعم:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب العروض الخاصة
router.get("/special-offers", async (req, res) => {
  try {
    const { restaurantId, categoryId } = req.query;
    
    let whereConditions = [
      eq(schema.specialOffers.isActive, true),
      sql`${schema.specialOffers.startDate} <= NOW()`,
      sql`${schema.specialOffers.endDate} >= NOW()`
    ];
    
    if (restaurantId) {
      whereConditions.push(eq(schema.specialOffers.restaurantId, restaurantId as string));
    }
    
    if (categoryId) {
      whereConditions.push(eq(schema.specialOffers.categoryId, categoryId as string));
    }

    const offers = await db.query.specialOffers.findMany({
      where: and(...whereConditions),
      with: {
        restaurantId: true,
        categoryId: true
      },
      orderBy: [desc(schema.specialOffers.priority), desc(schema.specialOffers.createdAt)]
    });

    res.json(offers);
  } catch (error) {
    console.error("خطأ في جلب العروض الخاصة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إنشاء طلب جديد
router.post("/orders", async (req, res) => {
  try {
    const orderData = req.body;
    
    // توليد رقم طلب فريد
    const orderNumber = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    const newOrderData = {
      ...orderData,
      orderNumber,
      status: "pending",
      paymentStatus: "pending"
    };

    const [newOrder] = await db.insert(schema.orders)
      .values(newOrderData)
      .returning();

    // إضافة تتبع للطلب
    await db.insert(schema.orderTracking).values({
      orderId: newOrder.id,
      status: "pending",
      message: "تم إنشاء الطلب بنجاح",
      createdByType: 'system'
    });

    // إشعار المطعم (يمكن إضافة WebSocket هنا)
    
    res.json(newOrder);
  } catch (error) {
    console.error("خطأ في إنشاء الطلب:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تتبع الطلب
router.get("/orders/:id/track", async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
      with: {
        restaurantId: true,
        driverId: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }

    // جلب تتبع الطلب
    const tracking = await db.query.orderTracking.findMany({
      where: eq(schema.orderTracking.orderId, id),
      orderBy: desc(schema.orderTracking.timestamp)
    });

    res.json({
      order,
      tracking
    });
  } catch (error) {
    console.error("خطأ في تتبع الطلب:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب إعدادات النظام العامة
router.get("/settings", async (req, res) => {
  try {
    const settings = await db.query.systemSettings.findMany({
      where: eq(schema.systemSettings.isPublic, true)
    });
    
    // تحويل الإعدادات إلى كائن
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as any);
    
    res.json(settingsObject);
  } catch (error) {
    console.error("خطأ في جلب الإعدادات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// البحث العام
router.get("/search", async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;
    
    if (!q) {
      return res.json({ restaurants: [], menuItems: [] });
    }

    const searchTerm = `%${q}%`;
    let results: any = {};

    if (type === 'all' || type === 'restaurants') {
      results.restaurants = await db.query.restaurants.findMany({
        where: and(
          eq(schema.restaurants.isActive, true),
          or(
            like(schema.restaurants.name, searchTerm),
            like(schema.restaurants.description, searchTerm)
          )
        ),
        with: {
          categoryId: true
        },
        limit: 10
      });
    }

    if (type === 'all' || type === 'menu') {
      results.menuItems = await db.query.menuItems.findMany({
        where: and(
          eq(schema.menuItems.isAvailable, true),
          or(
            like(schema.menuItems.name, searchTerm),
            like(schema.menuItems.description, searchTerm)
          )
        ),
        with: {
          restaurantId: true,
          sectionId: true
        },
        limit: 20
      });
    }

    res.json(results);
  } catch (error) {
    console.error("خطأ في البحث:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export { router as publicRoutes };