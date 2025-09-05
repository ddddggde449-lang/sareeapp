import React from 'react';
import { Router, Route, Switch } from 'wouter';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';

// صفحات العميل
import HomePage from '@/pages/HomePage';
import RestaurantPage from '@/pages/RestaurantPage';
import CartPage from '@/pages/CartPage';
import OrderTrackingPage from '@/pages/OrderTrackingPage';
import ProfilePage from '@/pages/ProfilePage';

// صفحات الإدارة
import AdminLoginPage from '@/pages/admin/AdminLoginPage';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminRestaurants from '@/pages/admin/AdminRestaurants';
import AdminOrders from '@/pages/admin/AdminOrders';
import AdminDrivers from '@/pages/admin/AdminDrivers';
import AdminOffers from '@/pages/admin/AdminOffers';
import AdminSettings from '@/pages/admin/AdminSettings';

// صفحات السائق
import DriverLoginPage from '@/pages/driver/DriverLoginPage';
import DriverDashboard from '@/pages/driver/DriverDashboard';
import DriverOrders from '@/pages/driver/DriverOrders';
import DriverStats from '@/pages/driver/DriverStats';
import DriverProfile from '@/pages/driver/DriverProfile';

// مكونات مشتركة
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DriverLayout } from '@/components/driver/DriverLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <Switch>
            {/* مسارات العميل */}
            <Route path="/" component={HomePage} />
            <Route path="/restaurant/:id" component={RestaurantPage} />
            <Route path="/cart" component={CartPage} />
            <Route path="/order/:id" component={OrderTrackingPage} />
            <Route path="/profile" component={ProfilePage} />

            {/* مسارات الإدارة */}
            <Route path="/admin-login" component={AdminLoginPage} />
            <Route path="/admin">
              <ProtectedRoute userType="admin">
                <AdminLayout>
                  <Switch>
                    <Route path="/admin" component={AdminDashboard} />
                    <Route path="/admin/restaurants" component={AdminRestaurants} />
                    <Route path="/admin/orders" component={AdminOrders} />
                    <Route path="/admin/drivers" component={AdminDrivers} />
                    <Route path="/admin/offers" component={AdminOffers} />
                    <Route path="/admin/settings" component={AdminSettings} />
                  </Switch>
                </AdminLayout>
              </ProtectedRoute>
            </Route>

            {/* مسارات السائق */}
            <Route path="/driver-login" component={DriverLoginPage} />
            <Route path="/delivery">
              <ProtectedRoute userType="driver">
                <DriverLayout>
                  <Switch>
                    <Route path="/delivery" component={DriverDashboard} />
                    <Route path="/delivery/orders" component={DriverOrders} />
                    <Route path="/delivery/stats" component={DriverStats} />
                    <Route path="/delivery/profile" component={DriverProfile} />
                  </Switch>
                </DriverLayout>
              </ProtectedRoute>
            </Route>

            {/* صفحة 404 */}
            <Route>
              <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                  <p className="text-gray-600 mb-8">الصفحة غير موجودة</p>
                  <a href="/" className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors">
                    العودة للرئيسية
                  </a>
                </div>
              </div>
            </Route>
          </Switch>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;