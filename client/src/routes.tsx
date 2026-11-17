/**
 * Every route in docs/BUILD_SPEC.md section 6, plus the fitting studio (/book-fitting, /admin/bookings).
 * Each page is its own lazy chunk with a default export.
 */
import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { ErrorBoundary } from '@/lib/ErrorBoundary';

type LazyPage = LazyExoticComponent<ComponentType>;

// Shells
const Layout = lazy(() => import('@/components/layout/Layout'));
const AccountLayout = lazy(() => import('@/pages/account/AccountLayout'));
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));

// Storefront
const HomePage = lazy(() => import('@/pages/home/HomePage'));
const FridayFivePage = lazy(() => import('@/pages/home/FridayFivePage'));
const ShopPage = lazy(() => import('@/pages/shop/ShopPage'));
const ComparePage = lazy(() => import('@/pages/shop/ComparePage'));
const ProductPage = lazy(() => import('@/pages/product/ProductPage'));
const FittingCardPage = lazy(() => import('@/pages/product/FittingCardPage'));
const CarsPage = lazy(() => import('@/pages/garage/CarsPage'));
const GaragePage = lazy(() => import('@/pages/garage/GaragePage'));
const WishlistPage = lazy(() => import('@/pages/account/WishlistPage'));
const CartPage = lazy(() => import('@/pages/cart/CartPage'));
const CheckoutPage = lazy(() => import('@/pages/checkout/CheckoutPage'));
const QuotePage = lazy(() => import('@/pages/checkout/QuotePage'));
const OrderPage = lazy(() => import('@/pages/order/OrderPage'));
const InvoicePage = lazy(() => import('@/pages/order/InvoicePage'));
const TrackPage = lazy(() => import('@/pages/order/TrackPage'));
const LoginPage = lazy(() => import('@/pages/account/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/account/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/account/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/account/ResetPasswordPage'));
const AccountOverviewPage = lazy(() => import('@/pages/account/OverviewPage'));
const AccountOrdersPage = lazy(() => import('@/pages/account/OrdersPage'));
const AccountAddressesPage = lazy(() => import('@/pages/account/AddressesPage'));
const AccountProfilePage = lazy(() => import('@/pages/account/ProfilePage'));
const NewCarPage = lazy(() => import('@/pages/kits/NewCarPage'));
const PocketBuildsPage = lazy(() => import('@/pages/kits/PocketBuildsPage'));
const BookFittingPage = lazy(() => import('@/pages/studio/BookFittingPage'));
const BookingLookupPage = lazy(() => import('@/pages/studio/BookingLookupPage'));
const GlossaryPage = lazy(() => import('@/pages/content/GlossaryPage'));
const StraightLabelPage = lazy(() => import('@/pages/content/StraightLabelPage'));
const AboutPage = lazy(() => import('@/pages/content/AboutPage'));
const ContactPage = lazy(() => import('@/pages/content/ContactPage'));
const FaqPage = lazy(() => import('@/pages/content/FaqPage'));
const CreditsPage = lazy(() => import('@/pages/content/CreditsPage'));
const PolicyPage = lazy(() => import('@/pages/content/PolicyPage'));
const StyleguidePage = import.meta.env.DEV ? lazy(() => import('@/pages/dev/StyleguidePage')) : null;
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// Admin
const AdminDashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const AdminFollowUpsPage = lazy(() => import('@/pages/admin/FollowUpsPage'));
const AdminDemandPage = lazy(() => import('@/pages/admin/DemandPage'));
const AdminOrdersPage = lazy(() => import('@/pages/admin/OrdersPage'));
const AdminOrderDetailPage = lazy(() => import('@/pages/admin/OrderDetailPage'));
const AdminBookingsPage = lazy(() => import('@/pages/admin/BookingsPage'));
const AdminQuotesPage = lazy(() => import('@/pages/admin/QuotesPage'));
const AdminQuoteEditPage = lazy(() => import('@/pages/admin/QuoteEditPage'));
const AdminCustomersPage = lazy(() => import('@/pages/admin/CustomersPage'));
const AdminCouponsPage = lazy(() => import('@/pages/admin/CouponsPage'));
const AdminProductsPage = lazy(() => import('@/pages/admin/ProductsPage'));
const AdminProductEditPage = lazy(() => import('@/pages/admin/ProductEditPage'));
const AdminCategoriesPage = lazy(() => import('@/pages/admin/CategoriesPage'));
const AdminDropsPage = lazy(() => import('@/pages/admin/DropsPage'));
const AdminFitmentDeskPage = lazy(() => import('@/pages/admin/FitmentDeskPage'));
const AdminReportsPage = lazy(() => import('@/pages/admin/ReportsPage'));
const AdminEnquiriesPage = lazy(() => import('@/pages/admin/EnquiriesPage'));
const AdminLeadsPage = lazy(() => import('@/pages/admin/LeadsPage'));
const AdminStockAlertsPage = lazy(() => import('@/pages/admin/StockAlertsPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));

/** Holds the page's space while its chunk loads, so the footer does not jump up and back. */
function PageFallback() {
  return (
    <div role="status" aria-live="polite" className="min-h-[70vh]">
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** A page, isolated: its own loading state, and an error boundary that clears when the path changes. */
function PageBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function page(Page: LazyPage) {
  return (
    <PageBoundary>
      <Page />
    </PageBoundary>
  );
}

function shell(Shell: LazyPage) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Shell />
    </Suspense>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Printable pages: no site chrome. */}
      <Route path="/fitting/:slug" element={page(FittingCardPage)} />
      <Route path="/order/:orderNumber/invoice" element={page(InvoicePage)} />

      <Route path="/admin" element={shell(AdminLayout)}>
        <Route index element={page(AdminDashboardPage)} />
        <Route path="followups" element={page(AdminFollowUpsPage)} />
        <Route path="demand" element={page(AdminDemandPage)} />
        <Route path="orders" element={page(AdminOrdersPage)} />
        <Route path="orders/:orderNumber" element={page(AdminOrderDetailPage)} />
        <Route path="bookings" element={page(AdminBookingsPage)} />
        <Route path="quotes" element={page(AdminQuotesPage)} />
        <Route path="quotes/new" element={page(AdminQuoteEditPage)} />
        <Route path="quotes/:id" element={page(AdminQuoteEditPage)} />
        <Route path="customers" element={page(AdminCustomersPage)} />
        <Route path="coupons" element={page(AdminCouponsPage)} />
        <Route path="products" element={page(AdminProductsPage)} />
        <Route path="products/new" element={page(AdminProductEditPage)} />
        <Route path="products/:id" element={page(AdminProductEditPage)} />
        <Route path="categories" element={page(AdminCategoriesPage)} />
        <Route path="drops" element={page(AdminDropsPage)} />
        <Route path="fitment-desk" element={page(AdminFitmentDeskPage)} />
        <Route path="reports" element={page(AdminReportsPage)} />
        <Route path="enquiries" element={page(AdminEnquiriesPage)} />
        <Route path="leads" element={page(AdminLeadsPage)} />
        <Route path="stock-alerts" element={page(AdminStockAlertsPage)} />
        <Route path="settings" element={page(AdminSettingsPage)} />
        <Route path="post-maker" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={page(NotFoundPage)} />
      </Route>

      <Route element={shell(Layout)}>
        <Route index element={page(HomePage)} />
        <Route path="/friday-five" element={page(FridayFivePage)} />

        <Route path="/shop" element={page(ShopPage)} />
        <Route path="/shop/:category" element={page(ShopPage)} />
        <Route path="/shop/:category/:sub" element={page(ShopPage)} />
        <Route path="/search" element={page(ShopPage)} />
        <Route path="/compare" element={page(ComparePage)} />
        <Route path="/p/:slug" element={page(ProductPage)} />

        <Route path="/cars" element={page(CarsPage)} />
        <Route path="/cars/:make" element={page(CarsPage)} />
        <Route path="/cars/:make/:model" element={page(CarsPage)} />
        <Route path="/garage" element={page(GaragePage)} />
        <Route path="/wishlist" element={page(WishlistPage)} />

        <Route path="/cart" element={page(CartPage)} />
        <Route path="/checkout" element={page(CheckoutPage)} />
        <Route path="/quote/:token" element={page(QuotePage)} />
        <Route path="/order/:orderNumber" element={page(OrderPage)} />
        <Route path="/track" element={page(TrackPage)} />

        <Route path="/login" element={page(LoginPage)} />
        <Route path="/register" element={page(RegisterPage)} />
        <Route path="/forgot-password" element={page(ForgotPasswordPage)} />
        <Route path="/reset-password" element={page(ResetPasswordPage)} />
        <Route path="/account" element={shell(AccountLayout)}>
          <Route index element={page(AccountOverviewPage)} />
          <Route path="orders" element={page(AccountOrdersPage)} />
          <Route path="addresses" element={page(AccountAddressesPage)} />
          <Route path="profile" element={page(AccountProfilePage)} />
        </Route>

        {/* Build Bay was removed: old links land on the shop. */}
        <Route path="/build-bay" element={<Navigate to="/shop" replace />} />
        <Route path="/builds/*" element={<Navigate to="/shop" replace />} />
        <Route path="/light-lab" element={<Navigate to="/shop" replace />} />
        <Route path="/show-plate" element={<Navigate to="/shop" replace />} />
        <Route path="/new-car" element={page(NewCarPage)} />
        <Route path="/pocket-builds" element={page(PocketBuildsPage)} />
        <Route path="/book-fitting" element={page(BookFittingPage)} />
        <Route path="/book-fitting/:number" element={page(BookingLookupPage)} />

        <Route path="/glossary" element={page(GlossaryPage)} />
        <Route path="/straight-label" element={page(StraightLabelPage)} />
        <Route path="/about" element={page(AboutPage)} />
        <Route path="/contact" element={page(ContactPage)} />
        <Route path="/faq" element={page(FaqPage)} />
        <Route path="/credits" element={page(CreditsPage)} />
        <Route path="/policies/:slug" element={page(PolicyPage)} />

        {/* The design-system sheet is for development only; production builds leave it out. */}
        {StyleguidePage && <Route path="/styleguide" element={page(StyleguidePage)} />}
        <Route path="*" element={page(NotFoundPage)} />
      </Route>
    </Routes>
  );
}
