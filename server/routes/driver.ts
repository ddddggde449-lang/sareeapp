import express from "express";
import { db } from "../db.js";
import * as schema from "../../shared/schema.js";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { sendNotification, broadcastToDrivers } from "../index.js";
import bcrypt from "bcrypt";

const router = express.Router();

// Middleware للتحقق من صلاحيات السائق
const requireDriver = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "غير مصرح" });
    }

    const token = authHeader.split(' ')[1];
    const session = await db.query.adminSessions.findFirst({
      where: eq(schema.adminSessions.token, token)
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: "جلسة منتهية الصلاحية" });
    }

    const driver = await db.query.adminUsers.findFirst({
      where: eq(schema.adminUsers.id, session.adminId)
    });

    if (!driver || driver.userType !== 'driver') {
      return res.status(403).json({ error: "صلاحيات غير كافية" });
    }

    req.driver = driver;
    next();
  } catch (error) {
    console.error("خطأ في التحقق من صلاحيات السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
};

// تسجيل دخول السائق
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const driver = await db.query.adminUsers.findFirst({
      where: and(
        eq(schema.adminUsers.phone, phone),
        eq(schema.adminUsers.userType, "driver")
      )
    });

    if (!driver) {
      return res.status(401).json({ error: "بيانات دخول خاطئة" });
    }

    // التحقق من كلمة المرور
    const isValidPassword = await bcrypt.compare(password, driver.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "بيانات دخول خاطئة" });
    }

    if (!driver.isActive) {
      return res.status(401).json({ error: "الحساب غير نشط" });
    }

    // إنشاء جلسة جديدة
    const token = `driver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ساعة

    await db.insert(schema.adminSessions).values({
      adminId: driver.id,
      token,
      userType: "driver",
      expiresAt
    });

    res.json({
      success: true,
      token,
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        userType: driver.userType
      }
    });
  } catch (error) {
    console.error("خطأ في تسجيل دخول السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تسجيل خروج السائق
router.post("/logout", requireDriver, async (req: any, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];

    await db.delete(schema.adminSessions)
      .where(eq(schema.adminSessions.token, token));

    res.json({ success: true });
  } catch (error) {
    console.error("خطأ في تسجيل خروج السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// لوحة معلومات السائق
router.get("/dashboard", requireDriver, async (req: any, res) => {
  try {
    const driverId = req.driver.id;
    
    // إحصائيات السائق
    const [todayStats] = await db.select({
      todayOrders: sql<number>`COUNT(CASE WHEN DATE(${schema.orders.createdAt}) = CURRENT_DATE THEN 1 END)`,
      todayEarnings: sql<number>`COALESCE(SUM(CASE WHEN DATE(${schema.orders.createdAt}) = CURRENT_DATE THEN ${schema.orders.driverEarnings} END), 0)`,
      completedToday: sql<number>`COUNT(CASE WHEN DATE(${schema.orders.createdAt}) = CURRENT_DATE AND ${schema.orders.status} = 'delivered' THEN 1 END)`,
      totalOrders: sql<number>`COUNT(*)`,
      totalEarnings: sql<number>`COALESCE(SUM(${schema.orders.driverEarnings}), 0)`,
      averageRating: sql<number>`COALESCE(AVG(${schema.orders.rating}), 0)`
    }).from(schema.orders)
      .where(eq(schema.orders.driverId, driverId));

    // الطلبات المتاحة (غير مُعيَّنة لسائق)
    const availableOrders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.status, "confirmed"),
        sql`${schema.orders.driverId} IS NULL`
      ),
      with: {
        restaurantId: true
      },
      orderBy: desc(schema.orders.createdAt),
      limit: 10
    });

    // الطلبات الحالية للسائق
    const currentOrders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.driverId, driverId),
        or(
          eq(schema.orders.status, "picked_up"),
          eq(schema.orders.status, "ready")
        )
      ),
      with: {
        restaurantId: true
      },
      orderBy: desc(schema.orders.createdAt)
    });

    res.json({
      stats: todayStats,
      availableOrders,
      currentOrders
    });
  } catch (error) {
    console.error("خطأ في لوحة معلومات السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// قبول طلب
router.post("/orders/:id/accept", requireDriver, async (req: any, res) => {
  try {
    const { id } = req.params;
    const driverId = req.driver.id;

    // التحقق من أن الطلب متاح
    const order = await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.id, id),
        eq(schema.orders.status, "confirmed"),
        sql`${schema.orders.driverId} IS NULL`
      )
    });

    if (!order) {
      return res.status(400).json({ error: "الطلب غير متاح" });
    }

    // تعيين السائق للطلب
    const [updatedOrder] = await db.update(schema.orders)
      .set({ 
        driverId,
        status: "ready",
        updatedAt: new Date()
      })
      .where(eq(schema.orders.id, id))
      .returning();

    // حساب أرباح السائق (مثلاً 80% من رسوم التوصيل)
    const driverEarnings = Number(order.deliveryFee) * 0.8;
    await db.update(schema.orders)
      .set({ driverEarnings })
      .where(eq(schema.orders.id, id));

    // إضافة تتبع للطلب
    await db.insert(schema.orderTracking).values({
      orderId: id,
      status: "ready",
      message: `تم قبول الطلب من قبل السائق ${req.driver.name}`,
      createdBy: driverId,
      createdByType: 'driver'
    });

    // إشعار العميل
    if (order.customerId) {
      sendNotification(order.customerId, {
        type: 'order_update',
        title: 'تم قبول طلبك',
        message: `السائق ${req.driver.name} في الطريق لاستلام طلبك`,
        orderId: id
      });
    }

    // إشعار السائقين الآخرين بأن الطلب لم يعد متاحاً
    broadcastToDrivers({
      type: 'order_taken',
      orderId: id,
      message: 'تم قبول الطلب من سائق آخر'
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error("خطأ في قبول الطلب:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تحديث حالة الطلب
router.put("/orders/:id/status", requireDriver, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status, location } = req.body;
    const driverId = req.driver.id;

    // التحقق من أن الطلب مُعيَّن للسائق
    const order = await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.id, id),
        eq(schema.orders.driverId, driverId)
      )
    });

    if (!order) {
      return res.status(403).json({ error: "غير مصرح بتحديث هذا الطلب" });
    }

    const updateData: any = { 
      status, 
      updatedAt: new Date() 
    };

    if (status === 'delivered') {
      updateData.actualDeliveryTime = new Date();
    }

    const [updatedOrder] = await db.update(schema.orders)
      .set(updateData)
      .where(eq(schema.orders.id, id))
      .returning();

    // إضافة تتبع للطلب
    await db.insert(schema.orderTracking).values({
      orderId: id,
      status,
      message: getStatusMessage(status),
      location: location ? JSON.stringify(location) : null,
      createdBy: driverId,
      createdByType: 'driver'
    });

    // إشعار العميل
    if (order.customerId) {
      sendNotification(order.customerId, {
        type: 'order_update',
        title: 'تحديث الطلب',
        message: getStatusMessage(status),
        orderId: id,
        status
      });
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error("خطأ في تحديث حالة الطلب:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب تفاصيل الطلب
router.get("/orders/:id", requireDriver, async (req: any, res) => {
  try {
    const { id } = req.params;
    const driverId = req.driver.id;

    const order = await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.id, id),
        eq(schema.orders.driverId, driverId)
      ),
      with: {
        restaurantId: true
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
      ...order,
      tracking
    });
  } catch (error) {
    console.error("خطأ في جلب تفاصيل الطلب:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب تاريخ الطلبات
router.get("/orders", requireDriver, async (req: any, res) => {
  try {
    const driverId = req.driver.id;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(schema.orders.driverId, driverId)];
    
    if (status && status !== 'all') {
      whereConditions.push(eq(schema.orders.status, status as string));
    }

    const orders = await db.query.orders.findMany({
      where: and(...whereConditions),
      with: {
        restaurantId: true
      },
      limit: Number(limit),
      offset,
      orderBy: desc(schema.orders.createdAt)
    });

    res.json(orders);
  } catch (error) {
    console.error("خطأ في جلب تاريخ الطلبات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إحصائيات السائق المفصلة
router.get("/stats", requireDriver, async (req: any, res) => {
  try {
    const driverId = req.driver.id;
    const { period = 'week' } = req.query;

    let dateFilter;
    switch (period) {
      case 'today':
        dateFilter = sql`DATE(${schema.orders.createdAt}) = CURRENT_DATE`;
        break;
      case 'week':
        dateFilter = sql`${schema.orders.createdAt} >= CURRENT_DATE - INTERVAL '7 days'`;
        break;
      case 'month':
        dateFilter = sql`${schema.orders.createdAt} >= CURRENT_DATE - INTERVAL '30 days'`;
        break;
      default:
        dateFilter = sql`1=1`;
    }

    const [stats] = await db.select({
      totalOrders: sql<number>`COUNT(*)`,
      completedOrders: sql<number>`COUNT(CASE WHEN ${schema.orders.status} = 'delivered' THEN 1 END)`,
      cancelledOrders: sql<number>`COUNT(CASE WHEN ${schema.orders.status} = 'cancelled' THEN 1 END)`,
      totalEarnings: sql<number>`COALESCE(SUM(${schema.orders.driverEarnings}), 0)`,
      averageRating: sql<number>`COALESCE(AVG(${schema.orders.rating}), 0)`,
      totalRevenue: sql<number>`COALESCE(SUM(${schema.orders.total}), 0)`
    }).from(schema.orders)
      .where(and(
        eq(schema.orders.driverId, driverId),
        dateFilter
      ));

    // إحصائيات يومية للأسبوع الماضي
    const dailyStats = await db.select({
      date: sql<string>`DATE(${schema.orders.createdAt})`,
      orders: sql<number>`COUNT(*)`,
      earnings: sql<number>`COALESCE(SUM(${schema.orders.driverEarnings}), 0)`
    }).from(schema.orders)
      .where(and(
        eq(schema.orders.driverId, driverId),
        sql`${schema.orders.createdAt} >= CURRENT_DATE - INTERVAL '7 days'`
      ))
      .groupBy(sql`DATE(${schema.orders.createdAt})`)
      .orderBy(sql`DATE(${schema.orders.createdAt})`);

    res.json({
      summary: stats,
      dailyStats
    });
  } catch (error) {
    console.error("خطأ في جلب إحصائيات السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تحديث الملف الشخصي
router.put("/profile", requireDriver, async (req: any, res) => {
  try {
    const driverId = req.driver.id;
    const updateData = req.body;

    // إزالة الحقول الحساسة
    delete updateData.password;
    delete updateData.userType;
    delete updateData.id;

    const [updatedDriver] = await db.update(schema.adminUsers)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(schema.adminUsers.id, driverId))
      .returning();

    res.json(updatedDriver);
  } catch (error) {
    console.error("خطأ في تحديث الملف الشخصي:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تغيير كلمة المرور
router.put("/change-password", requireDriver, async (req: any, res) => {
  try {
    const driverId = req.driver.id;
    const { currentPassword, newPassword } = req.body;

    // التحقق من كلمة المرور الحالية
    const driver = await db.query.adminUsers.findFirst({
      where: eq(schema.adminUsers.id, driverId)
    });

    if (!driver) {
      return res.status(404).json({ error: "السائق غير موجود" });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, driver.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: "كلمة المرور الحالية خاطئة" });
    }

    // تحديث كلمة المرور
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.update(schema.adminUsers)
      .set({ password: hashedNewPassword, updatedAt: new Date() })
      .where(eq(schema.adminUsers.id, driverId));

    res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (error) {
    console.error("خطأ في تغيير كلمة المرور:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// دالة مساعدة لرسائل الحالة
function getStatusMessage(status: string): string {
  const messages: { [key: string]: string } = {
    'ready': 'السائق في الطريق لاستلام الطلب',
    'picked_up': 'تم استلام الطلب وهو في الطريق إليك',
    'delivered': 'تم توصيل الطلب بنجاح',
    'cancelled': 'تم إلغاء الطلب'
  };
  
  return messages[status] || `تم تحديث حالة الطلب إلى: ${status}`;
}

export { router as driverRoutes };