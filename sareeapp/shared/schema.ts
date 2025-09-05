import { pgTable, text, integer, boolean, timestamp, decimal, uuid, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// جدول المديرين والسائقين
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  userType: text("user_type").notNull(), // 'admin' أو 'driver'
  isActive: boolean("is_active").default(true),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// جدول جلسات المصادقة
export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").references(() => adminUsers.id),
  token: text("token").notNull().unique(),
  userType: text("user_type").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// جدول التصنيفات الرئيسية
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  icon: text("icon"),
  image: text("image"),
  color: text("color").default("#FF6B35"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// جدول أقسام المطاعم/المحلات
export const restaurantSections = pgTable("restaurant_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  icon: text("icon"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// جدول المطاعم والمحلات
export const restaurants = pgTable("restaurants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  image: text("image"),
  logo: text("logo"),
  coverImage: text("cover_image"),
  categoryId: uuid("category_id").references(() => categories.id),
  phone: text("phone"),
  email: text("email"),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: integer("review_count").default(0),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0"),
  minimumOrder: decimal("minimum_order", { precision: 10, scale: 2 }).default("0"),
  deliveryTime: text("delivery_time").default("30-45 دقيقة"),
  isActive: boolean("is_active").default(true),
  isOpen: boolean("is_open").default(true),
  openingHours: jsonb("opening_hours"),
  tags: jsonb("tags"),
  features: jsonb("features"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// جدول عناصر القائمة
export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id").references(() => restaurants.id),
  sectionId: uuid("section_id").references(() => restaurantSections.id),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  image: text("image"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  isAvailable: boolean("is_available").default(true),
  isPopular: boolean("is_popular").default(false),
  isFeatured: boolean("is_featured").default(false),
  preparationTime: integer("preparation_time").default(15),
  calories: integer("calories"),
  ingredients: jsonb("ingredients"),
  allergens: jsonb("allergens"),
  nutritionInfo: jsonb("nutrition_info"),
  variants: jsonb("variants"),
  addons: jsonb("addons"),
  tags: jsonb("tags"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// جدول العملاء
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone").unique().notNull(),
  email: text("email").unique(),
  avatar: text("avatar"),
  dateOfBirth: timestamp("date_of_birth"),
  gender: text("gender"),
  isActive: boolean("is_active").default(true),
  totalOrders: integer("total_orders").default(0),
  totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).default("0"),
  loyaltyPoints: integer("loyalty_points").default(0),
  preferredLanguage: text("preferred_language").default("ar"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// جدول عناوين العملاء
export const customerAddresses = pgTable("customer_addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id),
  title: text("title").notNull(),
  address: text("address").notNull(),
  building: text("building"),
  floor: text("floor"),
  apartment: text("apartment"),
  landmark: text("landmark"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// جدول الطلبات
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: text("order_number").unique().notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  restaurantId: uuid("restaurant_id").references(() => restaurants.id),
  driverId: uuid("driver_id").references(() => adminUsers.id),
  status: text("status").notNull().default("pending"), // pending, confirmed, preparing, ready, picked_up, delivered, cancelled
  paymentStatus: text("payment_status").default("pending"), // pending, paid, failed, refunded
  paymentMethod: text("payment_method").default("cash"), // cash, card, wallet
  
  // تفاصيل الطلب
  items: jsonb("items").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0"),
  serviceFee: decimal("service_fee", { precision: 10, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  
  // معلومات التوصيل
  deliveryAddress: jsonb("delivery_address").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerName: text("customer_name").notNull(),
  deliveryInstructions: text("delivery_instructions"),
  estimatedDeliveryTime: timestamp("estimated_delivery_time"),
  actualDeliveryTime: timestamp("actual_delivery_time"),
  
  // معلومات السائق
  driverEarnings: decimal("driver_earnings", { precision: 10, scale: 2 }).default("0"),
  driverNotes: text("driver_notes"),
  
  // تقييم ومراجعة
  rating: integer("rating"),
  review: text("review"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// جدول العروض الخاصة
export const specialOffers = pgTable("special_offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  titleEn: text("title_en"),
  description: text("description"),
  image: text("image"),
  bannerImage: text("banner_image"),
  type: text("type").notNull(), // discount, buy_one_get_one, free_delivery, combo
  discountType: text("discount_type"), // percentage, fixed_amount
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }),
  minimumOrder: decimal("minimum_order", { precision: 10, scale: 2 }).default("0"),
  maxDiscount: decimal("max_discount", { precision: 10, scale: 2 }),
  
  // ربط العرض
  restaurantId: uuid("restaurant_id").references(() => restaurants.id),
  categoryId: uuid("category_id").references(() => categories.id),
  menuItemIds: jsonb("menu_item_ids"),
  
  // صلاحية العرض
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  daysOfWeek: jsonb("days_of_week"),
  
  // إعدادات العرض
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").default(0),
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// جدول الإشعارات
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(), // order_update, promotion, system, driver_alert
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"),
  
  // المستقبل
  recipientType: text("recipient_type").notNull(), // customer, driver, admin, all
  recipientId: uuid("recipient_id"),
  
  // حالة الإشعار
  isRead: boolean("is_read").default(false),
  isSent: boolean("is_sent").default(false),
  sentAt: timestamp("sent_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// جدول التقييمات والمراجعات
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id),
  restaurantId: uuid("restaurant_id").references(() => restaurants.id),
  orderId: uuid("order_id").references(() => orders.id),
  menuItemId: uuid("menu_item_id").references(() => menuItems.id),
  
  rating: integer("rating").notNull(),
  comment: text("comment"),
  images: jsonb("images"),
  
  // تقييمات فرعية
  foodQuality: integer("food_quality"),
  deliverySpeed: integer("delivery_speed"),
  packaging: integer("packaging"),
  driverService: integer("driver_service"),
  
  isApproved: boolean("is_approved").default(true),
  adminResponse: text("admin_response"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// جدول إعدادات النظام
export const systemSettings = pgTable("system_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").unique().notNull(),
  value: jsonb("value"),
  description: text("description"),
  category: text("category").default("general"),
  isPublic: boolean("is_public").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// جدول إحصائيات السائقين
export const driverStats = pgTable("driver_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  driverId: uuid("driver_id").references(() => adminUsers.id),
  date: timestamp("date").notNull(),
  
  // إحصائيات يومية
  totalOrders: integer("total_orders").default(0),
  completedOrders: integer("completed_orders").default(0),
  cancelledOrders: integer("cancelled_orders").default(0),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0"),
  totalDistance: decimal("total_distance", { precision: 8, scale: 2 }).default("0"),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"),
  onlineHours: decimal("online_hours", { precision: 5, scale: 2 }).default("0"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// جدول تتبع الطلبات
export const orderTracking = pgTable("order_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id),
  status: text("status").notNull(),
  message: text("message"),
  location: jsonb("location"),
  timestamp: timestamp("timestamp").defaultNow(),
  createdBy: uuid("created_by"),
  createdByType: text("created_by_type"), // system, admin, driver, restaurant
});

// Schemas للتحقق من البيانات
export const insertAdminUserSchema = createInsertSchema(adminUsers);
export const selectAdminUserSchema = createSelectSchema(adminUsers);

export const insertCategorySchema = createInsertSchema(categories);
export const selectCategorySchema = createSelectSchema(categories);

export const insertRestaurantSchema = createInsertSchema(restaurants);
export const selectRestaurantSchema = createSelectSchema(restaurants);

export const insertMenuItemSchema = createInsertSchema(menuItems);
export const selectMenuItemSchema = createSelectSchema(menuItems);

export const insertOrderSchema = createInsertSchema(orders);
export const selectOrderSchema = createSelectSchema(orders);

export const insertSpecialOfferSchema = createInsertSchema(specialOffers);
export const selectSpecialOfferSchema = createSelectSchema(specialOffers);

export const insertNotificationSchema = createInsertSchema(notifications);
export const selectNotificationSchema = createSelectSchema(notifications);

export const insertReviewSchema = createInsertSchema(reviews);
export const selectReviewSchema = createSelectSchema(reviews);

// أنواع TypeScript
export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Restaurant = typeof restaurants.$inferSelect;
export type NewRestaurant = typeof restaurants.$inferInsert;

export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type SpecialOffer = typeof specialOffers.$inferSelect;
export type NewSpecialOffer = typeof specialOffers.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;