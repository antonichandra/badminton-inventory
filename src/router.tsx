import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { ViewTransitionHandler } from "./core/components/ViewTransitionHandler";
import { ProtectedLayout } from "./core/components/ProtectedLayout";
import { LoginPage } from "./pages/Login";
import { WaitingApprovalPage } from "./pages/WaitingApproval";
import { UnexpectedErrorPage } from "./pages/UnexpectedErrorPage";
import { DashboardPage } from "./pages/Dashboard";
import { ProdukPage } from "./pages/master/ProdukPage";
import { KategoriProdukPage } from "./pages/master/categories/KategoriProdukPage";
import { SupplierPage } from "./pages/master/suppliers/SupplierPage";
import { PenerimaanBarangPage } from "./pages/master/PenerimaanBarangPage";
import { RolePage } from "./pages/master/RolePage";
import { AkunPage } from "./pages/master/AkunPage";
import { KalkulatorPage } from "./pages/master/KalkulatorPage";
import { BusinessListPage } from "./pages/business/BusinessListPage";
import { BusinessFormPage } from "./pages/business/BusinessFormPage";
import { KasirPage } from "./pages/KasirPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { InventoryPage } from "./pages/InventoryPage";
import { StockCardPage } from "./pages/inventory/StockCardPage";

function RootLayout() {
  return (
    <>
      <ViewTransitionHandler />
      <Outlet />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <UnexpectedErrorPage />,
    children: [
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/waiting-approval",
        element: <WaitingApprovalPage />,
      },
      {
        path: "/",
        element: <ProtectedLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: <DashboardPage /> },
          { path: "business", element: <BusinessListPage /> },
          { path: "business/new", element: <BusinessFormPage /> },
          { path: "business/:businessId/edit", element: <BusinessFormPage /> },
          { path: "kasir", element: <KasirPage /> },
          { path: "analytics", element: <AnalyticsPage /> },
          { path: "stok", element: <InventoryPage /> },
          { path: "stok/kartu-stok", element: <StockCardPage /> },
          { path: "master/produk", element: <ProdukPage /> },
          { path: "master/kategori-produk", element: <KategoriProdukPage /> },
          { path: "master/supplier", element: <SupplierPage /> },
          { path: "master/penerimaan-barang", element: <PenerimaanBarangPage /> },
          { path: "master/role", element: <RolePage /> },
          { path: "master/akun", element: <AkunPage /> },
          { path: "master/kalkulator", element: <KalkulatorPage /> },
        ],
      },
      {
        path: "*",
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
]);
