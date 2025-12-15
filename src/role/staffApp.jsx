// src/staff/StaffApp.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../firebase.config";
import StaffSidebar from "./roleComponents/Sidebar";
import StaffTopbar from "./roleComponents/Topbar";
import StaffCalendar from "./rolePages/Calendar";
import StaffPatientUser from "./rolePages/PatientUser";
import StaffBilling from "./rolePages/Billing";
import StaffDentalRecords from "./rolePages/DentalRecords";
import StaffNotification from "./rolePages/Notification";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function StaffApp() {
  const navigate = useNavigate();


  const [page, setPage] = useState("Calendar");

  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "staff") {
      localStorage.clear();
      navigate("/", { replace: true });
      return;
    }

    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        localStorage.removeItem("role");
        navigate("/", { replace: true });
      }
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [navigate]);

  // Logout handler
  const handleLogout = async () => {
    try {
      if (auth && typeof auth.signOut === "function") {
        await auth.signOut();
      } else {
        const { signOut } = await import("firebase/auth");
        await signOut(auth);
      }
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      localStorage.removeItem("role");
      navigate("/", { replace: true });
    }
  };

  // Sidebar toggle helpers
  const openMobileSidebar = (next) => {
    if (typeof next === "boolean") setSidebarOpen(next);
    else setSidebarOpen((s) => !s);
  };

  const toggleCollapsed = (next) => {
    if (typeof next === "boolean") setSidebarCollapsed(next);
    else setSidebarCollapsed((s) => !s);
  };

  // Render staff pages
  const renderPage = () => {
    switch (page) {
      // ✅ Appointment (Calendar)
      case "Calendar":
        return <StaffCalendar />;

      // ✅ Patient Users
      case "Patient Users":
        return <StaffPatientUser />;

      // ✅ Dental Records
      case "Dental Records":
        return <StaffDentalRecords />;

      // ✅ Notification
      case "Notification":
        return <StaffNotification />;

      // ✅ Billing
      case "Billing":
        return <StaffBilling />;

      // Default: Appointment
      default:
        return <StaffCalendar />;
    }
  };

  const pageTitle = page === "Calendar" ? "Appointment" : page;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <StaffSidebar
        setPage={(k) => {
          setPage(k);
          setSidebarOpen(false);
        }}
        currentPage={page}
        handleLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onToggle={(next) => toggleCollapsed(next)}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <StaffTopbar
          pageTitle={pageTitle}
          onMobileMenu={() => openMobileSidebar(true)}
          onCollapseToggle={() => toggleCollapsed()}
          handleLogout={handleLogout}
          collapsed={sidebarCollapsed}
        />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto bg-white rounded-md shadow-sm">
            {renderPage()}
          </div>
        </main>
      </div>

      {/* Toast notifications */}
      <ToastContainer
        position="top-right"
        autoClose={3500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
      />
    </div>
  );
}