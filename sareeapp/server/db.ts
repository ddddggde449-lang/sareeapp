import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../shared/schema.js";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL غير محدد في متغيرات البيئة");
}

// إنشاء اتصال قاعدة البيانات
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

// دالة تهيئة قاعدة البيانات
export async function initializeDatabase() {
  try {
    console.log("🔄 جاري تهيئة قاعدة البيانات...");
    
    // إنشاء مدير النظام الافتراضي
    const existingAdmin = await db.query.adminUsers.findFirst({
      where: (users, { eq }) => eq(users.email, "aymenpro124@gmail.com")
    });

    if (!existingAdmin) {
      await db.insert(schema.adminUsers).values({
        email: "aymenpro124@gmail.com",
        password: "777146387", // في الإنتاج يجب تشفير كلمة المرور
        name: "مدير النظام",
        userType: "admin",
        isActive: true,
      });
      console.log("✅ تم إنشاء مدير النظام الافتراضي");
    }

    // إنشاء سائق تجريبي
    const existingDriver = await db.query.adminUsers.findFirst({
      where: (users, { eq }) => eq(users.phone, "+967771234567")
    });

    if (!existingDriver) {
      await db.insert(schema.adminUsers).values({
        phone: "+967771234567",
        password: "password123",
        name: "سائق تجريبي",
        userType: "driver",
        isActive: true,
      });
      console.log("✅ تم إنشاء السائق التجريبي");
    }

    // إنشاء التصنيفات الافتراضية
    const existingCategories = await db.query.categories.findMany();
    
    if (existingCategories.length === 0) {
      const defaultCategories = [
        {
          name: "المطاعم",
          nameEn: "Restaurants",
          description: "مطاعم متنوعة",
          icon: "🍽️",
          color: "#FF6B35"
        },
        {
          name: "الحلويات",
          nameEn: "Sweets",
          description: "حلويات ومعجنات",
          icon: "🧁",
          color: "#FF6B35"
        },
        {
          name: "اللحوم",
          nameEn: "Meat",
          description: "لحوم طازجة",
          icon: "🥩",
          color: "#FF6B35"
        },
        {
          name: "كل التصنيفات",
          nameEn: "All Categories",
          description: "جميع التصنيفات",
          icon: "📋",
          color: "#FF6B35"
        }
      ];

      await db.insert(schema.categories).values(defaultCategories);
      console.log("✅ تم إنشاء التصنيفات الافتراضية");
    }

    // إنشاء أقسام المطاعم الافتراضية
    const existingSections = await db.query.restaurantSections.findMany();
    
    if (existingSections.length === 0) {
      const defaultSections = [
        { name: "المضغوط", nameEn: "Grilled", icon: "🔥" },
        { name: "البروست", nameEn: "Fried Chicken", icon: "🍗" },
        { name: "المشروبات", nameEn: "Beverages", icon: "🥤" },
        { name: "السلطات", nameEn: "Salads", icon: "🥗" },
        { name: "الحلويات", nameEn: "Desserts", icon: "🍰" },
        { name: "المقبلات", nameEn: "Appetizers", icon: "🥙" }
      ];

      await db.insert(schema.restaurantSections).values(defaultSections);
      console.log("✅ تم إنشاء أقسام المطاعم الافتراضية");
    }

    // إعدادات النظام الافتراضية
    const existingSettings = await db.query.systemSettings.findMany();
    
    if (existingSettings.length === 0) {
      const defaultSettings = [
        {
          key: "app_name",
          value: "السريع ون",
          description: "اسم التطبيق",
          category: "general",
          isPublic: true
        },
        {
          key: "currency",
          value: "YER",
          description: "العملة المستخدمة",
          category: "general",
          isPublic: true
        },
        {
          key: "delivery_fee",
          value: 500,
          description: "رسوم التوصيل الافتراضية",
          category: "delivery",
          isPublic: true
        },
        {
          key: "minimum_order",
          value: 1000,
          description: "الحد الأدنى للطلب",
          category: "orders",
          isPublic: true
        },
        {
          key: "service_fee_percentage",
          value: 5,
          description: "نسبة رسوم الخدمة",
          category: "fees",
          isPublic: false
        }
      ];

      await db.insert(schema.systemSettings).values(defaultSettings);
      console.log("✅ تم إنشاء إعدادات النظام الافتراضية");
    }

    console.log("✅ تم تهيئة قاعدة البيانات بنجاح");
    
  } catch (error) {
    console.error("❌ خطأ في تهيئة قاعدة البيانات:", error);
    throw error;
  }
}

// تشغيل التهيئة عند بدء التطبيق
initializeDatabase().catch(console.error);