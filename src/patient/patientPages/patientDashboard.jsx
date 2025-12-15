import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../../firebase.config";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  Users,
  Eye,
  X,
  Printer,
  FileText,
  Activity,
  Stethoscope,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

function StatusBadge({ status }) {
  const s = (status || "").toString().toLowerCase();
  
  if (s === "confirmed" || s === "paid") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-700 text-[10px] font-medium border border-green-300">
        <CheckCircle size={12} />
        Confirmed
      </span>
    );
  }
  
  if (s === "pending" || s === "unpaid") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-50 text-yellow-700 text-[10px] font-medium border border-yellow-300">
        <Clock size={12} />
        Pending
      </span>
    );
  }
  
  if (s === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 text-[10px] font-medium border border-red-300">
        <XCircle size={12} />
        Cancelled
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-50 text-gray-700 text-[10px] font-medium border border-gray-300">
      —
    </span>
  );
}

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loadingPatient, setLoadingPatient] = useState(true);

  const [activeTab, setActiveTab] = useState("appointment");
  const [appointments, setAppointments] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState(null);

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  const apptUnsubRef = useRef(null);
  const treatUnsubRef = useRef(null);
  const authUnsubRef = useRef(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    upcoming: 0,
    completed: 0,
  });

  useEffect(() => {
    setLoadingPatient(true);
    authUnsubRef.current = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setPatient(null);
        setLoadingPatient(false);
        return;
      }

      try {
        const uRef = doc(db, "users", user.uid);
        const snap = await getDoc(uRef);
        if (snap && snap.exists()) {
          const data = snap.data();
          setPatient({
            uid: user.uid,
            firstName: data.firstName || user.displayName?.split(" ")?.[0] || "",
            lastName: data.lastName || user.displayName?.split(" ")?.slice(1).join(" ") || "",
            email: data.email || user.email || "",
            contactNumber: data.contactNumber || user.phoneNumber || "",
            address: data.address || "",
            gender: data.gender || "",
            birthdate: data.birthdate || "",
            avatarUrl: data.avatarUrl || "",
          });
        } else {
          setPatient({
            uid: user.uid,
            firstName: user.displayName?.split(" ")?.[0] || "",
            lastName: user.displayName?.split(" ").slice(1).join(" ") || "",
            email: user.email || "",
            contactNumber: user.phoneNumber || "",
            address: "",
            gender: "",
            birthdate: "",
            avatarUrl: "",
          });
        }
      } catch (e) {
        console.error("Failed to load patient doc:", e);
        setPatient({
          uid: user.uid,
          firstName: user.displayName?.split(" ")?.[0] || "",
          lastName: user.displayName?.split(" ").slice(1).join(" ") || "",
          email: user.email || "",
          contactNumber: user.phoneNumber || "",
          avatarUrl: "",
        });
      } finally {
        setLoadingPatient(false);
      }
    });

    return () => {
      try {
        if (authUnsubRef.current) authUnsubRef.current();
      } catch (e) {}
    };
  }, [navigate]);

  useEffect(() => {
    if (!patient?.uid) return;
    setLoadingData(true);

    try {
      // Load Appointments from onlineRequests
      const q = query(collection(db, "onlineRequests"), where("userId", "==", patient.uid));
      apptUnsubRef.current = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => {
            const da = `${a.date || ""} ${a.time || ""}`;
            const dbv = `${b.date || ""} ${b.time || ""}`;
            return String(dbv).localeCompare(String(da));
          });
          setAppointments(list);
          
          // Calculate stats
          const today = new Date().toISOString().split('T')[0];
          const upcoming = list.filter(a => 
            (a.status === 'confirmed' || a.status === 'pending') && a.date >= today
          ).length;
          const completed = list.filter(a => a.status === 'treated').length;
          
          setStats({
            total: list.length,
            upcoming: upcoming,
            completed: completed
          });
          
          setLoadingData(false);
        },
        (err) => {
          console.error("appointments snapshot err:", err);
          setAppointments([]);
          setLoadingData(false);
        }
      );
    } catch (e) {
      console.error("appointments subscribe error:", e);
    }

    try {
      // Load Treatments - from both appointments and onlineRequests where status = "treated"
      const q1 = query(
        collection(db, "appointments"), 
        where("userId", "==", patient.uid),
        where("status", "==", "treated")
      );
      
      const q2 = query(
        collection(db, "onlineRequests"), 
        where("userId", "==", patient.uid),
        where("status", "==", "treated")
      );

      // Subscribe to appointments
      const unsubAppt = onSnapshot(q1, (snap1) => {
        const apptTreatments = snap1.docs.map((d) => ({
          id: d.id,
          source: "appointment",
          ...d.data()
        }));

        // Subscribe to onlineRequests
        const unsubOnline = onSnapshot(q2, (snap2) => {
          const onlineTreatments = snap2.docs.map((d) => ({
            id: d.id,
            source: "onlineRequest",
            ...d.data()
          }));

          const allTreatments = [...apptTreatments, ...onlineTreatments];
          allTreatments.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          setTreatments(allTreatments);
        });

        treatUnsubRef.current = () => {
          unsubAppt();
          unsubOnline();
        };
      });
    } catch (e) {
      console.error("treatments subscribe error:", e);
    }

    return () => {
      try {
        if (apptUnsubRef.current) apptUnsubRef.current();
        if (treatUnsubRef.current) treatUnsubRef.current();
      } catch (e) {}
    };
  }, [patient?.uid]);

  const cancelAppointment = async (apptId) => {
    if (!apptId) return;
    try {
      const aRef = doc(db, "appointments", apptId);
      await updateDoc(aRef, { status: "cancelled", cancelledAt: serverTimestamp() });
      toast.success("Appointment cancelled successfully!");
      setConfirmCancelOpen(false);
      setCancelTarget(null);
    } catch (e) {
      console.error("cancelAppointment err:", e);
      toast.error("Failed to cancel appointment");
    }
  };

  const openReceipt = (a) => {
    if (!a) return;

    const reservation = a.paymentsSummary?.reservation || null;
    const payments = a.payments || [];
    const reservationFromPayments = payments.find((p) => p.type === "reservation") || reservation || null;

    const clinic = {
      name: "Your Dental Clinic",
      address: "123 Clinic Street, City",
      phone: "(+63) 912-345-6789",
      email: "info@clinic.example",
    };

    const patientName = `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() || "Patient";
    const serviceDesc = a.treatmentOption || a.treatment || "Service";
    const price = Number(a.price ?? 0);
    const reservationAmount = Number(reservationFromPayments?.amount ?? 0);

    const items = [];
    if (reservationAmount > 0) {
      items.push({
        description: `Reservation Fee — ${serviceDesc}`,
        qty: 1,
        unitPrice: reservationAmount,
        amount: reservationAmount,
      });
    } else {
      const fallback = Number(a.reservationAmount ?? 0);
      if (fallback > 0) {
        items.push({
          description: `Reservation Fee (Due) — ${serviceDesc}`,
          qty: 1,
          unitPrice: fallback,
          amount: fallback,
        });
      } else {
        items.push({
          description: serviceDesc,
          qty: 1,
          unitPrice: price,
          amount: price,
        });
      }
    }

    const subtotal = items.reduce((s, it) => s + (it.amount || 0), 0);
    const tax = Number(a.tax ?? 0);
    const totalPaid = reservationAmount;
    const total = subtotal + tax;
    const balance = Math.max(0, (price || total) - totalPaid);

    const receipt = {
      invoiceId: reservationFromPayments?.paymentDocId || a.id,
      clinic,
      patientName,
      patientId: a.userId || patient?.uid || "",
      items,
      subtotal,
      tax,
      total,
      totalPaid,
      balance,
      paymentMethod: reservationFromPayments ? reservationFromPayments.gateway || reservationFromPayments.method || a.reservationMethod || "PayPal" : a.reservationMethod || "—",
      transactionId: reservationFromPayments?.txId || reservationFromPayments?.transactionId || "—",
      status: a.status || a.reservationStatus || (reservationFromPayments ? "paid" : "unpaid"),
      createdAt: reservationFromPayments?.createdAt || a.createdAt || a.date || new Date().toISOString(),
      note: reservationFromPayments ? "Reservation fee (non-refundable subject to clinic policy)" : "Reservation not paid",
    };

    setReceiptData(receipt);
    setReceiptOpen(true);
  };

  const openView = (a) => {
    if (!a) return;
    setViewData(a);
    setViewOpen(true);
  };

  const closeView = () => {
    setViewOpen(false);
    setViewData(null);
  };

  const printReceipt = (r) => {
    if (!r) return;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Please allow pop-ups to print receipt.");
      return;
    }

    const dateStr = new Date(r.createdAt).toLocaleString();
    const escapeHtml = (str) => {
      if (str == null) return "";
      return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    };

    const formatCurrency = (n) => {
      const num = Number(n || 0);
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt - ${escapeHtml(r.invoiceId)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #222; margin: 0; padding: 24px; }
            .wrap { max-width: 800px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 24px; }
            header { display:flex; justify-content:space-between; margin-bottom:16px; }
            .clinic { font-weight:700; font-size:18px; color:#0f766e; }
            .meta { text-align:right; font-size:12px; color:#555; }
            .patient { margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius:6px; }
            table { width:100%; border-collapse: collapse; margin-top: 8px; }
            th, td { text-align:left; padding:8px 10px; border-bottom:1px solid #e6e9ee; font-size:13px; }
            th { background: #f3f4f6; color:#374151; font-weight:600; }
            .totals { margin-top: 12px; }
            .totals td { padding:6px 10px; font-size:14px; }
            .right { text-align:right; }
            footer { margin-top:18px; font-size:12px; color:#6b7280; text-align:center; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <header>
              <div>
                <div class="clinic">${escapeHtml(r.clinic.name)}</div>
                <div>${escapeHtml(r.clinic.address)}</div>
                <div>${escapeHtml(r.clinic.phone)} • ${escapeHtml(r.clinic.email)}</div>
              </div>
              <div class="meta">
                <div>Invoice: <strong>${escapeHtml(r.invoiceId)}</strong></div>
                <div>Date: ${escapeHtml(dateStr)}</div>
              </div>
            </header>

            <div class="patient">
              <strong>Patient:</strong> ${escapeHtml(r.patientName)}
            </div>

            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th class="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${r.items.map(it => `
                  <tr>
                    <td>${escapeHtml(it.description)}</td>
                    <td>${it.qty}</td>
                    <td>₱${formatCurrency(it.unitPrice)}</td>
                    <td class="right">₱${formatCurrency(it.amount)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <table class="totals">
              <tr>
                <td>Subtotal</td>
                <td class="right">₱${formatCurrency(r.subtotal)}</td>
              </tr>
              <tr>
                <td>Paid</td>
                <td class="right">₱${formatCurrency(r.totalPaid)}</td>
              </tr>
              <tr>
                <td><strong>Balance</strong></td>
                <td class="right"><strong>₱${formatCurrency(r.balance)}</strong></td>
              </tr>
            </table>

            <footer>Thank you for your payment!</footer>
          </div>
        </body>
      </html>
    `; 

    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  if (loadingPatient) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded border-2 border-gray-400 text-center max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Dashboard Access</h2>
          <p className="text-gray-600 text-sm mb-6">Please sign in to view your dashboard.</p>
          <button
            onClick={() => navigate("/")}
            className="w-full px-6 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="max-w-[1400px] mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded border-2 border-gray-400 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Total Appointments</p>
                <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="text-blue-600" size={20} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded border-2 border-gray-400 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Upcoming</p>
                <p className="text-2xl font-bold text-gray-800">{stats.upcoming}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Activity className="text-green-600" size={20} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded border-2 border-gray-400 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Completed</p>
                <p className="text-2xl font-bold text-gray-800">{stats.completed}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <CheckCircle className="text-purple-600" size={20} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Patient Info Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded border border-gray-300 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-600" />
                Patient Info
              </h3>
              
              <div className="flex flex-col items-center mb-4">
                {patient.avatarUrl ? (
                  <img
                    src={patient.avatarUrl}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-300 mb-3"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-2xl font-bold text-white border-2 border-gray-300 mb-3">
                    {(patient.firstName || "P").charAt(0).toUpperCase()}
                  </div>
                )}
                
                <div className="text-center">
                  <div className="font-semibold text-gray-800 text-sm">
                    {patient.firstName} {patient.lastName}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{patient.email}</div>
                </div>
              </div>

              <div className="space-y-3 text-xs border-t pt-4">
                <div className="flex items-start gap-2">
                  <Users className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-500">Gender</div>
                    <div className="text-gray-800 font-medium">{patient.gender || "—"}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Calendar className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-500">Birthdate</div>
                    <div className="text-gray-800 font-medium">{patient.birthdate || "—"}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Phone className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-500">Phone</div>
                    <div className="text-gray-800 font-medium">{patient.contactNumber || "—"}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-500">Address</div>
                    <div className="text-gray-800 font-medium text-[10px] break-words">{patient.address || "—"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Tab Navigation */}
            <div className="bg-white rounded border border-gray-300 p-2 mb-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("appointment")}
                  className={`flex-1 px-3 py-2 rounded text-xs font-semibold transition-all ${
                    activeTab === "appointment"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Calendar size={14} />
                    Appointments
                  </div>
                </button>
                
                <button
                  onClick={() => setActiveTab("treatment")}
                  className={`flex-1 px-3 py-2 rounded text-xs font-semibold transition-all ${
                    activeTab === "treatment"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Stethoscope size={14} />
                    Treatments
                  </div>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded border border-gray-300 p-4">
              {activeTab === "appointment" && (
                <div>
                  <h2 className="text-base font-bold text-gray-800 mb-4">My Appointments</h2>
                  {appointments.length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No appointments found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-400 rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100 border-b border-gray-400">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">Treatment</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">Dentist</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">Date</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">Time</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {appointments.map((a) => (
                            <tr 
                              key={a.id} 
                              onClick={() => openView(a)}
                              className="border-b border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <td className="px-3 py-2 text-gray-800 border-r border-gray-200">
                                <div className="font-medium">{a.treatmentOption || a.treatment}</div>
                              </td>
                              <td className="px-3 py-2 text-gray-800 border-r border-gray-200">
                                {a.preferredDentist || a.dentistName || "Any"}
                              </td>
                              <td className="px-3 py-2 text-gray-800 border-r border-gray-200">
                                {a.date}
                              </td>
                              <td className="px-3 py-2 text-gray-800 border-r border-gray-200">
                                {a.time}
                              </td>
                              <td className="px-3 py-2">
                                <StatusBadge status={a.status || a.reservationStatus} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "treatment" && (
                <div>
                  <h2 className="text-base font-bold text-gray-800 mb-4">My Treatments</h2>
                  {treatments.length === 0 ? (
                    <div className="text-center py-12">
                      <Stethoscope className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No treatment records found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-400 rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100 border-b border-gray-400">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">Treatment</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">Teeth No/s</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">Description</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {treatments.map((t) => (
                            <tr key={t.id} className="border-b border-gray-300 hover:bg-gray-50 transition-colors">
                              <td className="px-3 py-2 text-gray-800 border-r border-gray-200">
                                <div className="font-medium">{t.treatment || t.treatmentName || "—"}</div>
                                {t.treatmentOption && (
                                  <div className="text-[10px] text-gray-500 mt-0.5">{t.treatmentOption}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-800 border-r border-gray-200">
                                {t.teethNo || t.teeth || t.teethNos || "—"}
                              </td>
                              <td className="px-3 py-2 text-gray-800 border-r border-gray-200">
                                <div className="max-w-xs truncate">{t.description || "—"}</div>
                              </td>
                              <td className="px-3 py-2 text-gray-800">
                                {t.date || t.dateVisit || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {receiptOpen && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <h3 className="text-lg font-semibold text-gray-700">Reservation Receipt</h3>
                <button
                  onClick={() => {
                    setReceiptOpen(false);
                    setReceiptData(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                  <div className="text-base font-bold text-gray-800 mb-1">{receiptData.clinic.name}</div>
                  <div className="text-xs text-gray-600">{receiptData.clinic.address}</div>
                  <div className="text-xs text-gray-600">{receiptData.clinic.phone} • {receiptData.clinic.email}</div>
                </div>

                <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                  <div className="text-[10px] text-gray-600 mb-1">Patient</div>
                  <div className="font-bold text-gray-800">{receiptData.patientName}</div>
                  <div className="text-xs text-gray-500">ID: {receiptData.patientId}</div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-3 text-sm">Items</h4>
                  <div className="border border-gray-300 rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-gray-700">Description</th>
                          <th className="text-center px-3 py-2 font-semibold text-gray-700">Qty</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-700">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receiptData.items.map((it, idx) => (
                          <tr key={idx} className="border-t border-gray-200">
                            <td className="px-3 py-2">{it.description}</td>
                            <td className="px-3 py-2 text-center">{it.qty}</td>
                            <td className="px-3 py-2 text-right font-medium">
                              ₱{Number(it.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">₱{Number(receiptData.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Paid</span>
                      <span className="font-medium text-green-600">₱{Number(receiptData.totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-300">
                      <span className="font-bold text-gray-800">Balance</span>
                      <span className="font-bold text-red-600">₱{Number(receiptData.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-medium">{receiptData.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transaction ID:</span>
                    <span className="font-medium">{receiptData.transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <StatusBadge status={receiptData.status} />
                  </div>
                </div>

                {receiptData.note && (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded text-xs text-blue-800">
                    {receiptData.note}
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => printReceipt(receiptData)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded font-medium hover:bg-gray-50 transition-all text-sm"
                  >
                    <Printer size={16} />
                    Print
                  </button>
                  <button
                    onClick={() => {
                      setReceiptOpen(false);
                      setReceiptData(null);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-all text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewOpen && viewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="text-blue-600" size={20} />
                  Appointment Details
                </h3>
                <button
                  onClick={closeView}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 border border-gray-300 p-3 rounded">
                    <div className="text-[10px] text-gray-600 mb-1">Service</div>
                    <div className="font-bold text-gray-800 text-sm">{viewData.treatmentOption || viewData.treatment || "—"}</div>
                  </div>

                  <div className="bg-gray-50 border border-gray-300 p-3 rounded">
                    <div className="text-[10px] text-gray-600 mb-1">Status</div>
                    <StatusBadge status={viewData.status || viewData.reservationStatus} />
                  </div>

                  <div className="bg-gray-50 border border-gray-300 p-3 rounded">
                    <div className="text-[10px] text-gray-600 mb-1 flex items-center gap-1">
                      <Calendar size={10} />
                      Date
                    </div>
                    <div className="font-semibold text-gray-800 text-sm">{viewData.date || "—"}</div>
                  </div>

                  <div className="bg-gray-50 border border-gray-300 p-3 rounded">
                    <div className="text-[10px] text-gray-600 mb-1 flex items-center gap-1">
                      <Clock size={10} />
                      Time
                    </div>
                    <div className="font-semibold text-gray-800 text-sm">{viewData.time || "—"}</div>
                  </div>

                  <div className="bg-gray-50 border border-gray-300 p-3 rounded md:col-span-2">
                    <div className="text-[10px] text-gray-600 mb-1 flex items-center gap-1">
                      <User size={10} />
                      Dentist
                    </div>
                    <div className="font-semibold text-gray-800 text-sm">{viewData.preferredDentist || viewData.dentistName || "Any"}</div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-300 p-3 rounded md:col-span-2">
                    <div className="text-[10px] text-gray-600 mb-1">Health Declaration</div>
                    <div className="text-xs text-gray-800">{viewData.healthDeclaration || "No declaration provided"}</div>
                  </div>
                </div>

                {viewData.health?.questions && viewData.health?.answers && (
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 text-sm">Health Screening</h4>
                    <div className="bg-gray-50 border border-gray-300 rounded p-3 max-h-64 overflow-auto">
                      <div className="space-y-2 text-xs">
                        {viewData.health.questions.map((q) => (
                          <div key={q.id} className="flex justify-between items-start py-2 border-b last:border-0">
                            <div className="pr-4 flex-1">{q.text}</div>
                            <div className={`font-bold ${
                              viewData.health.answers[q.id] === "yes" 
                                ? "text-amber-600" 
                                : viewData.health.answers[q.id] === "no" 
                                ? "text-emerald-600" 
                                : "text-gray-400"
                            }`}>
                              {viewData.health.answers[q.id]?.toUpperCase() || "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => openReceipt(viewData)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded font-medium hover:bg-gray-50 transition-all text-sm"
                  >
                    <FileText size={16} />
                    View Receipt
                  </button>
                  {(!viewData.status || viewData.status !== "cancelled") && (
                    <button
                      onClick={() => {
                        setCancelTarget(viewData);
                        setConfirmCancelOpen(true);
                        closeView();
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-all font-medium text-sm"
                    >
                      <XCircle size={16} />
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={closeView}
                    className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-all text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {confirmCancelOpen && cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Cancel Appointment?</h3>
              <p className="text-gray-600 text-sm">This action cannot be undone.</p>
            </div>

            <div className="bg-gray-50 border border-gray-300 rounded p-4 mb-6">
              <div className="font-semibold text-gray-800 text-sm">{cancelTarget.treatmentOption || cancelTarget.treatment}</div>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {cancelTarget.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {cancelTarget.time}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setConfirmCancelOpen(false);
                  setCancelTarget(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded font-medium hover:bg-gray-50 transition-all text-sm"
              >
                Keep It
              </button>
              <button
                onClick={() => cancelAppointment(cancelTarget.id)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 transition-all text-sm"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}