import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../shared/schema.js";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL غير محدد في متغيرات البيئة");
}

// إنشاء اتصال قاعدة البيانات مع SSL
const sql = neon(process.env.DATABASE_URL, {
  ssl: true,
  sslmode: 'require'
});

export const db = drizzle(sql, { schema });

// دالة تهيئة قاعدة البيانات
export async function initializeDatabase() {
  try {
    console.log("🔄 جاري تهيئة قاعدة البيانات...");
    
    // اختبار الاتصال
    await sql`SELECT 1`;
    console.log("✅ تم الاتصال بقاعدة البيانات بنجاح");
    
    // إنشاء مدير النظام الافتراضي
    const existingAdmin = await db.query.adminUsers.findFirst({
      where: (users, { eq }) => eq(users.email, "aymenpro124@gmail.com")
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("777146387", 10);
      await db.insert(schema.adminUsers).values({
        email: "aymenpro124@gmail.com",
        password: hashedPassword,
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
      const hashedPassword = await bcrypt.hash("password123", 10);
      await db.insert(schema.adminUsers).values({
        phone: "+967771234567",
        password: hashedPassword,
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
          image: "https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg",
          color: "#FF6B35"
        },
        {
          name: "الحلويات",
          nameEn: "Sweets",
          description: "حلويات ومعجنات",
          icon: "🧁",
          image: "https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg",
          color: "#FF6B35"
        },
        {
          name: "اللحوم",
          nameEn: "Meat",
          description: "لحوم طازجة",
          icon: "🥩",
          image: "https://images.pexels.com/photos/65175/pexels-photo-65175.jpeg",
          color: "#FF6B35"
        },
        {
          name: "كل التصنيفات",
          nameEn: "All Categories",
          description: "جميع التصنيفات",
          icon: "📋",
          image: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg",
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

    // إنشاء مطاعم تجريبية
    const existingRestaurants = await db.query.restaurants.findMany();
    
    if (existingRestaurants.length === 0) {
      const categories = await db.query.categories.findMany();
      const restaurantCategory = categories.find(c => c.name === "المطاعم");
      
      if (restaurantCategory) {
        const defaultRestaurants = [
          {
            name: "مطعم الأصالة",
            nameEn: "Al Asala Restaurant",
            description: "أشهى الأطباق اليمنية التقليدية",
            image: "https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg",
            logo: "https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg",
            categoryId: restaurantCategory.id,
            phone: "+967771234567",
            address: "شارع الزبيري، صنعاء",
            rating: "4.5",
            deliveryFee: "500",
            minimumOrder: "1000",
            deliveryTime: "30-45 دقيقة",
            isActive: true,
            isOpen: true
          },
          {
            name: "مطعم البركة",
            nameEn: "Al Baraka Restaurant",
            description: "أطباق شعبية لذيذة",
            image: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg",
            logo: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg",
            categoryId: restaurantCategory.id,
            phone: "+967771234568",
            address: "شارع الستين، صنعاء",
            rating: "4.2",
            deliveryFee: "400",
            minimumOrder: "800",
            deliveryTime: "25-40 دقيقة",
            isActive: true,
            isOpen: true
          }
        ];

        const insertedRestaurants = await db.insert(schema.restaurants).values(defaultRestaurants).returning();
        console.log("✅ تم إنشاء المطاعم التجريبية");

        // إضافة عناصر قائمة تجريبية
        const sections = await db.query.restaurantSections.findMany();
        const grilledSection = sections.find(s => s.name === "المضغوط");
        const friedSection = sections.find(s => s.name === "البروست");

        if (grilledSection && friedSection && insertedRestaurants.length > 0) {
          const menuItems = [
            {
              restaurantId: insertedRestaurants[0].id,
              sectionId: grilledSection.id,
              name: "دجاج مضغوط",
              nameEn: "Grilled Chicken",
              description: "دجاج مضغوط مع الأرز والسلطة",
              image: "https://images.pexels.com/photos/106343/pexels-photo-106343.jpeg",
              price: "2500",
              isAvailable: true,
              isPopular: true,
              preparationTime: 25
            },
            {
              restaurantId: insertedRestaurants[0].id,
              sectionId: friedSection.id,
              name: "بروست دجاج",
              nameEn: "Fried Chicken",
              description: "قطع دجاج مقلية مقرمشة",
              image: "https://images.pexels.com/photos/60616/fried-chicken-chicken-fried-crunchy-60616.jpeg",
              price: "2000",
              isAvailable: true,
              preparationTime: 20
            },
            {
              restaurantId: insertedRestaurants[1].id,
              sectionId: grilledSection.id,
              name: "لحم مضغوط",
              nameEn: "Grilled Meat",
              description: "لحم مضغوط مع الخضار",
              image: "https://images.pexels.com/photos/65175/pexels-photo-65175.jpeg",
              price: "3000",
              isAvailable: true,
              preparationTime: 30
            }
          ];

          await db.insert(schema.menuItems).values(menuItems);
          console.log("✅ تم إنشاء عناصر القائمة التجريبية");
        }
      }
    }

    // إنشاء عروض خاصة تجريبية
    const existingOffers = await db.query.specialOffers.findMany();
    
    if (existingOffers.length === 0) {
      const restaurants = await db.query.restaurants.findMany();
      
      if (restaurants.length > 0) {
        const defaultOffers = [
          {
            title: "خصم 20% على جميع الوجبات",
            titleEn: "20% Off All Meals",
            description: "خصم خاص لفترة محدودة",
            image: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg",
            type: "discount",
            discountType: "percentage",
            discountValue: "20",
            minimumOrder: "1500",
            restaurantId: restaurants[0].id,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 يوم
            isActive: true,
            priority: 1
          }
        ];

        await db.insert(schema.specialOffers).values(defaultOffers);
        console.log("✅ تم إنشاء العروض الخاصة التجريبية");
      }
    }

    console.log("✅ تم تهيئة قاعدة البيانات بنجاح");
    
  } catch (error) {
    console.error("❌ خطأ في تهيئة قاعدة البيانات:", error);
    throw error;
  }
}

// تشغيل التهيئة عند بدء التطبيق
initializeDatabase().catch(console.error);