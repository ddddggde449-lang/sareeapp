import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { db } from "./db.js";
import { adminRoutes } from "./routes/admin.js";
import { customerRoutes } from "./routes/customer.js";
import { driverRoutes } from "./routes/driver.js";
import { publicRoutes } from "./routes/public.js";
import { setupVite, serveStatic } from "./vite.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// إعداد WebSocket للإشعارات المباشرة
const wss = new WebSocketServer({ server });

// تخزين اتصالات WebSocket
const connections = new Map();

wss.on('connection', (ws, req) => {
  console.log('اتصال WebSocket جديد');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'auth') {
        connections.set(data.userId, { ws, userType: data.userType });
        console.log(`تم تسجيل المستخدم: ${data.userId} - ${data.userType}`);
      }
    } catch (error) {
      console.error('خطأ في معالجة رسالة WebSocket:', error);
    }
  });
  
  ws.on('close', () => {
    // إزالة الاتصال عند الإغلاق
    for (const [userId, connection] of connections.entries()) {
      if (connection.ws === ws) {
        connections.delete(userId);
        console.log(`تم قطع الاتصال للمستخدم: ${userId}`);
        break;
      }
    }
  });
});

// دالة إرسال الإشعارات
export function sendNotification(userId: string, notification: any) {
  const connection = connections.get(userId);
  if (connection && connection.ws.readyState === 1) {
    connection.ws.send(JSON.stringify({
      type: 'notification',
      data: notification
    }));
  }
}

// دالة إرسال إشعار لجميع السائقين
export function broadcastToDrivers(notification: any) {
  for (const [userId, connection] of connections.entries()) {
    if (connection.userType === 'driver' && connection.ws.readyState === 1) {
      connection.ws.send(JSON.stringify({
        type: 'notification',
        data: notification
      }));
    }
  }
}

// إعداد الجلسات
const PgSession = ConnectPgSimple(session);

app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'saree-one-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 ساعة
  },
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// إعداد CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api', publicRoutes);

// إعداد Vite أو الملفات الثابتة
if (process.env.NODE_ENV === "development") {
  await setupVite(app);
} else {
  serveStatic(app);
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  console.log(`📱 تطبيق العملاء: http://localhost:${PORT}`);
  console.log(`🏢 لوحة التحكم: http://localhost:${PORT}/admin`);
  console.log(`🚚 تطبيق السائقين: http://localhost:${PORT}/delivery`);
});

// معالجة الأخطاء
process.on('uncaughtException', (error) => {
  console.error('خطأ غير معالج:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('رفض غير معالج في:', promise, 'السبب:', reason);
});