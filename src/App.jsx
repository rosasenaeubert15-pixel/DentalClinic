// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import MainWebsiteApp from "./website/mainwebsiteApp";
import WebsiteApp from "./website/websiteApp";
import PatientApp from "./patient/patientApp";
import AdminApp from "./role/adminApp";
import StaffApp from "./role/staffApp";
import DentistApp from "./role/dentistApp";

export default function App() {
  return (
    <>
      <ToastContainer
        position="top-center"
        autoClose={3500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnHover
        draggable
        theme="colored"
      />

      <Routes>
        <Route path="/" element={<MainWebsiteApp />} />
        <Route path="/auth" element={<WebsiteApp />} />
        <Route path="/patient" element={<PatientApp />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="/staff" element={<StaffApp />} />
        <Route path="/dentist" element={<DentistApp />} />
      </Routes>
    </>
  );
}
