import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import {
  Search,
  Eye,
  X,
  DollarSign,
  User,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Printer,
  History,
  CreditCard,
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Price list from PatientAppointment.jsx
const treatments = [
  {
    category: "Cleaning (LINIS)",
    options: [
      { type: "Mild to Average Deposit (Tartar)", price: 650, time: 30 },
      { type: "Moderate to Heavy Deposit", price: 900, time: 60 },
      { type: "Additional Stain Removal (Prophy Jet)", price: 300, time: 30 },
    ],
  },
  {
    category: "Filling (PASTA)",
    options: [
      { type: "Temporary", price: 400, time: 30 },
      { type: "Permanent", price: 1150, time: 60 },
    ],
  },
  {
    category: "Tooth Extraction (BUNOT)",
    options: [
      { type: "Regular", price: 600, time: 30 },
      { type: "Complicated", price: 1000, time: 60 },
      { type: "Surgery", price: 5500, time: 60 },
    ],
  },
  {
    category: "Crown / Bridge (JACKET) - per unit",
    options: [
      { type: "Porcelain", price: 7000, time: 60 },
      { type: "Plastic", price: 3000, time: 60 },
      { type: "Temporary", price: 300, time: 30 },
    ],
  },
  {
    category: "Complete Denture (Upper or Lower)",
    options: [
      { type: "Ordinary", price: 5000, time: 60 },
      { type: "Lucitone", price: 7000, time: 60 },
      { type: "Flexicryl", price: 16000, time: 60 },
      { type: "Ivocap", price: 15000, time: 60 },
      { type: "Porcelain Pontic", price: 10000, time: 60 },
    ],
  },
  {
    category: "Orthodontics (BRACES)",
    options: [
      { type: "Conventional (Metal) - Full", price: 35000, time: 60 },
      { type: "Conventional (Metal) - DP", price: 10000, time: 30 },
      { type: "Ceramic - Full", price: 45000, time: 60 },
      { type: "Ceramic - DP", price: 15000, time: 30 },
      { type: "Self-ligating - Full", price: 55000, time: 60 },
      { type: "Self-ligating - DP", price: 25000, time: 30 },
      { type: "Upper OR Lower Only (Metal)", price: 20000, time: 60 },
      { type: "Upper OR Lower DP", price: 8000, time: 30 },
      { type: "Per Adjustment", price: 1000, time: 30 },
    ],
  },
  {
    category: "Retainer",
    options: [
      { type: "Hawley Retainer (Plain)", price: 1500, time: 30 },
      { type: "Invisible Retainer", price: 3500, time: 30 },
      { type: "Soft Mouthguard", price: 3500, time: 30 },
    ],
  },
  {
    category: "Partial Denture",
    options: [
      { type: "Ordinary", price: 3750, time: 60 },
      { type: "Ordinary (1-3 teeth missing)", price: 2750, time: 30 },
      { type: "Metal Framework (Uni)", price: 7000, time: 60 },
      { type: "Metal Framework (Bila)", price: 10000, time: 60 },
      { type: "Flexible", price: 10500, time: 60 },
      { type: "Thermosense", price: 14000, time: 60 },
      { type: "Combination Flexi-Metal", price: 13000, time: 60 },
    ],
  },
  {
    category: "Porcelain Pontic on RPD (additional)",
    options: [{ type: "Porcelain Pontic", price: 2500, time: 30 }],
  },
  {
    category: "Whitening",
    options: [{ type: "In-Office", price: 6000, time: 60 }],
  },
  {
    category: "Veneers",
    options: [
      { type: "Ceramage", price: 11000, time: 60 },
      { type: "E-max", price: 14000, time: 60 },
      { type: "Zirconia", price: 16000, time: 60 },
      { type: "Direct Composite", price: 2500, time: 30 },
    ],
  },
  {
    category: "Root Canal Therapy",
    options: [{ type: "Per Canal", price: 3500, time: 60 }],
  },
  {
    category: "TMJ Therapy",
    options: [
      { type: "Splint", price: 7000, time: 60 },
      { type: "Expander", price: 8000, time: 60 },
      { type: "Bionator", price: 10000, time: 60 },
      { type: "Combination Appliance (Phase 1)", price: 10000, time: 60 },
      { type: "Per Adjustment", price: 1500, time: 30 },
    ],
  },
  {
    category: "Denture Repair",
    options: [
      { type: "Denture Repair", price: 600, time: 30 },
      { type: "Replacement Pontic (Plastic)", price: 300, time: 30 },
    ],
  },
];

// Function to get price from treatment name
function getTreatmentPrice(treatmentName) {
  for (const category of treatments) {
    const option = category.options.find(
      (opt) =>
        `${category.category} - ${opt.type}`.toLowerCase() ===
        treatmentName.toLowerCase()
    );
    if (option) return option.price;
  }
  return 0;
}

// ============ TRANSACTION ID GENERATOR ============
// Generates a consistent transaction ID format for both cash and online payments
function generateTransactionId(method = 'cash') {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substr(2, 9).toUpperCase();
  return `TXN-${timestamp}-${randomStr}`;
}

export default function Billing() {
  const [billings, setBillings] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [patients, setPatients] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");

  const [paymentModal, setPaymentModal] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [submitting, setSubmitting] = useState(false);

  const [viewModal, setViewModal] = useState(false);
  const [viewBilling, setViewBilling] = useState(null);
  const [viewedBillings, setViewedBillings] = useState(new Set());
  
  const [transactionHistoryModal, setTransactionHistoryModal] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Load viewed billings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('viewedBillings');
    if (saved) {
      try {
        setViewedBillings(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error('Failed to load viewed billings:', e);
      }
    }
  }, []);

  // Load users
  useEffect(() => {
    async function loadUsers() {
      try {
        const snap = await getDocs(collection(db, "users"));
        const data = {};
        snap.forEach((d) => (data[d.id] = d.data()));
        setPatients(data);
      } catch (e) {
        console.error("load users error:", e);
      }
    }
    loadUsers();
  }, []);

  // Load treated patients from Treatment.jsx
  useEffect(() => {
    const unsubscribers = [];

    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("status", "==", "treated")
    );
    
    const unsubAppt = onSnapshot(appointmentsQuery, (snap) => {
      const appointmentBillings = snap.docs.map((d) => {
        const data = d.data();
        const treatmentName = data.treatmentOption || data.treatment || "";
        const price = data.price || getTreatmentPrice(treatmentName);
        const amountPaid = data.amountPaid || 0;
        const balance = price - amountPaid;
        
        return {
          id: d.id,
          source: "appointment",
          patientId: data.userId || null,
          patientName: data.patientName || "Unknown",
          dateVisit: data.date || "N/A",
          treatment: data.treatment || "N/A",
          treatmentOption: data.treatmentOption || "",
          totalAmount: price,
          amountPaid: amountPaid,
          balance: balance,
          status: balance <= 0 ? "paid" : amountPaid > 0 ? "partial" : "unpaid",
          payments: data.payments || [],
          createdAt: data.createdAt,
        };
      });

      const onlineQuery = query(
        collection(db, "onlineRequests"),
        where("status", "==", "treated")
      );
      
      const unsubOnline = onSnapshot(onlineQuery, (onlineSnap) => {
        const onlineBillings = onlineSnap.docs.map((d) => {
          const data = d.data();
          const patName = getPatientName(data.userId);
          const treatmentName = data.treatmentOption || data.treatment || "";
          const price = data.price || getTreatmentPrice(treatmentName);
          const amountPaid = data.amountPaid || 0;
          const balance = price - amountPaid;
          
          return {
            id: d.id,
            source: "onlineRequest",
            patientId: data.userId || null,
            patientName: patName,
            dateVisit: data.date || "N/A",
            treatment: data.treatment || "N/A",
            treatmentOption: data.treatmentOption || "",
            totalAmount: price,
            amountPaid: amountPaid,
            balance: balance,
            status: balance <= 0 ? "paid" : amountPaid > 0 ? "partial" : "unpaid",
            payments: data.payments || [],
            createdAt: data.createdAt,
          };
        });

        const allBillings = [...appointmentBillings, ...onlineBillings];
        setBillings(allBillings);
        setFiltered(allBillings);
        setLoading(false);
      });

      unsubscribers.push(unsubOnline);
    });

    unsubscribers.push(unsubAppt);

    return () => {
      unsubscribers.forEach((unsub) => unsub && unsub());
    };
  }, [patients]);

  const getPatientName = (userId) => {
    const u = patients[userId];
    return u
      ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Unknown"
      : "Unknown";
  };

  // Filter logic
  useEffect(() => {
    let result = billings;

    // Status filter
    if (statusFilter !== "All") {
      result = result.filter((b) => b.status === statusFilter.toLowerCase());
    }

    // Search filter
    if (search.trim()) {
      const needle = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.patientName?.toLowerCase().includes(needle) ||
          b.treatment?.toLowerCase().includes(needle) ||
          b.treatmentOption?.toLowerCase().includes(needle) ||
          b.status?.toLowerCase().includes(needle)
      );
    }

    setFiltered(result);
    setCurrentPage(1);
  }, [billings, search, statusFilter]);

  // Count by status
  const allCount = billings.length;
  const paidCount = billings.filter((b) => b.status === "paid").length;
  const partialCount = billings.filter((b) => b.status === "partial").length;
  const unpaidCount = billings.filter((b) => b.status === "unpaid").length;

  // Pagination
  const totalPages = Math.ceil(filtered.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const paginatedData = filtered.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  function openPaymentModal(billing) {
    setSelectedBilling(billing);
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentMethod("cash");
    setPaymentModal(true);
  }

  function closePaymentModal() {
    setPaymentModal(false);
    setSelectedBilling(null);
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentMethod("cash");
  }

  async function handlePaymentSubmit() {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount > selectedBilling.balance) {
      toast.error("Payment amount cannot exceed balance");
      return;
    }

    setSubmitting(true);

    try {
      const newPayment = {
        amount: amount,
        date: new Date().toISOString().split("T")[0],
        note: paymentNote,
        method: paymentMethod,
        createdAt: new Date().toISOString(),
        transactionId: generateTransactionId(paymentMethod),
      };

      const newAmountPaid = selectedBilling.amountPaid + amount;
      const newBalance = selectedBilling.totalAmount - newAmountPaid;
      const newStatus = newBalance <= 0 ? "paid" : newAmountPaid > 0 ? "partial" : "unpaid";

      const collectionName = selectedBilling.source === "appointment" ? "appointments" : "onlineRequests";
      const docRef = doc(db, collectionName, selectedBilling.id);

      await updateDoc(docRef, {
        amountPaid: newAmountPaid,
        balance: newBalance,
        paymentStatus: newStatus,
        payments: [...(selectedBilling.payments || []), newPayment],
        updatedAt: serverTimestamp(),
      });

      // Create payment_reminder notification for patient
      await addDoc(collection(db, "notifications"), {
        userId: selectedBilling.patientId,
        type: "payment_reminder",
        title: "Payment Recorded",
        message: `Payment of ₱${amount.toFixed(2)} has been recorded for your ${selectedBilling.treatment} treatment. Your remaining balance is ₱${Math.max(0, newBalance).toFixed(2)}.`,
        read: false,
        details: {
          billingId: selectedBilling.id,
          amount: amount,
          treatment: selectedBilling.treatment,
          method: paymentMethod,
          newBalance: Math.max(0, newBalance),
          paymentStatus: newStatus,
        },
        createdAt: serverTimestamp(),
      });

      toast.success(`Payment recorded successfully via ${paymentMethod === 'cash' ? 'Cash' : 'PayPal'}!`);
      closePaymentModal();
    } catch (err) {
      console.error("handlePaymentSubmit error:", err);
      toast.error("Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  }

  function openViewModal(billing) {
    setViewBilling(billing);
    setViewModal(true);
    
    // Mark as viewed
    const newViewed = new Set(viewedBillings);
    newViewed.add(billing.id);
    setViewedBillings(newViewed);
    
    // Save to localStorage
    try {
      localStorage.setItem('viewedBillings', JSON.stringify([...newViewed]));
    } catch (e) {
      console.error('Failed to save viewed billings:', e);
    }
  }

  function closeViewModal() {
    setViewModal(false);
    setViewBilling(null);
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      paid: { icon: CheckCircle, color: "text-green-600 bg-green-50", label: "Paid" },
      partial: { icon: Clock, color: "text-yellow-600 bg-yellow-50", label: "Partial" },
      unpaid: { icon: XCircle, color: "text-red-600 bg-red-50", label: "Unpaid" },
    };

    const config = statusConfig[status] || statusConfig.unpaid;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.color}`}>
        <Icon size={12} />
        {config.label}
      </div>
    );
  };

  // Check if billing is new (created in last 24 hours and not viewed)
  const isNewBilling = (billing) => {
    if (viewedBillings.has(billing.id)) return false;
    
    if (!billing.createdAt) return false;
    
    try {
      let createdDate;
      if (typeof billing.createdAt === 'object' && typeof billing.createdAt.toDate === 'function') {
        createdDate = billing.createdAt.toDate();
      } else if (typeof billing.createdAt === 'object' && typeof billing.createdAt.toMillis === 'function') {
        createdDate = new Date(billing.createdAt.toMillis());
      } else {
        createdDate = new Date(billing.createdAt);
      }
      
      const now = new Date();
      const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
      
      return hoursDiff <= 24;
    } catch (e) {
      return false;
    }
  };

  // Generate Invoice
  const generateInvoice = (billing) => {
    setSelectedInvoice(billing);
    setInvoiceModal(true);
  };

  // Print Invoice
  const printInvoice = () => {
    window.print();
  };

  

  // View Transaction History
  const viewTransactionHistory = (billing) => {
    setSelectedBilling(billing);
    setTransactionHistoryModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading billing records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="max-w-[1400px] mx-auto space-y-4">
        
        {/* Status Summary Cards */}
        <div className="bg-white rounded border border-gray-300 p-4">
          <div className="grid grid-cols-4 gap-3">
            <button 
              onClick={() => setStatusFilter('All')}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === 'All' 
                  ? 'border-gray-500 bg-gray-50' 
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="text-2xl font-bold text-gray-700">{allCount}</div>
              <div className="text-xs text-gray-600 font-semibold mt-1">ALL BILLINGS</div>
            </button>
            
            <button 
              onClick={() => setStatusFilter('paid')}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === 'paid' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-green-300 hover:bg-green-50'
              }`}
            >
              <div className="text-2xl font-bold text-green-600">{paidCount}</div>
              <div className="text-xs text-gray-600 font-semibold mt-1">PAID</div>
            </button>
            
            <button 
              onClick={() => setStatusFilter('partial')}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === 'partial' 
                  ? 'border-yellow-500 bg-yellow-50' 
                  : 'border-yellow-300 hover:bg-yellow-50'
              }`}
            >
              <div className="text-2xl font-bold text-yellow-600">{partialCount}</div>
              <div className="text-xs text-gray-600 font-semibold mt-1">PARTIAL</div>
            </button>
            
            <button 
              onClick={() => setStatusFilter('unpaid')}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === 'unpaid' 
                  ? 'border-red-500 bg-red-50' 
                  : 'border-red-300 hover:bg-red-50'
              }`}
            >
              <div className="text-2xl font-bold text-red-600">{unpaidCount}</div>
              <div className="text-xs text-gray-600 font-semibold mt-1">UNPAID</div>
            </button>
          </div>
        </div>

        {/* Main Data Table */}
        <div className="bg-white rounded border border-gray-300 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Show</span>
              <select 
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-400 rounded px-2 py-1 text-xs bg-white"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
              </select>
              <span className="text-xs text-gray-600">entries</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search patient, treatment..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border px-3 py-1 rounded text-xs border-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-400 rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b border-gray-400">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Patient
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Treatment
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Total
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Paid
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Balance
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Transaction ID
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-500">
                      {statusFilter !== "All" 
                        ? `No ${statusFilter} billings found` 
                        : "No billing records found"}
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((billing, idx) => {
                    const isNew = isNewBilling(billing);
                    return (
                      <tr
                        key={billing.id}
                        onClick={() => openViewModal(billing)}
                        className={`border-b border-gray-300 transition-colors cursor-pointer ${
                          isNew 
                            ? 'bg-blue-50 hover:bg-blue-100 font-medium' 
                            : 'hover:bg-gray-50'
                        }`}
                        title={isNew ? 'New billing - click to view' : 'Click to view details'}
                      >
                        <td className="px-3 py-2 text-gray-800 border-r border-gray-200">
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-gray-400" />
                            <span className="font-medium">{billing.patientName}</span>
                            {isNew && (
                              <span className="ml-auto px-1.5 py-0.5 bg-blue-600 text-white rounded text-[9px] font-bold">
                                NEW
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-800 border-r border-gray-200">
                          <div>
                            <div className="font-medium">{billing.treatment}</div>
                            {billing.treatmentOption && (
                              <div className="text-[10px] text-gray-500">
                                {billing.treatmentOption}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-800 border-r border-gray-200 font-medium">
                          ₱{billing.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-green-600 border-r border-gray-200 font-medium">
                          ₱{billing.amountPaid.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-red-600 border-r border-gray-200 font-bold">
                          ₱{billing.balance.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-gray-600 border-r border-gray-200 text-[10px] font-mono">
                          {billing.payments && billing.payments.length > 0 
                            ? billing.payments[billing.payments.length - 1].transactionId 
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {getStatusBadge(billing.status)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-3">
            <div className="text-xs text-gray-700">
              Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
              <span className="font-medium">{Math.min(endIndex, filtered.length)}</span> of{" "}
              <span className="font-medium">{filtered.length}</span> entries
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs border border-gray-400 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <div className="flex gap-1">
                {getPageNumbers().map((page, idx) => (
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-2 py-1 text-xs border rounded ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  )
                ))}
              </div>
              
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs border border-gray-400 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal - Slides from Right (only when viewModal is closed) */}
      {paymentModal && selectedBilling && !viewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
          <div className="bg-white h-full w-full max-w-md shadow-2xl overflow-y-auto animate-slide-in">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <DollarSign className="text-green-600" size={20} />
                  Add Payment
                </h3>
                <button
                  onClick={closePaymentModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-300 p-3 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <User size={14} className="text-gray-500" />
                    <span className="text-xs text-gray-600">Patient</span>
                  </div>
                  <div className="font-medium text-gray-800">
                    {selectedBilling.patientName}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-300 p-3 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={14} className="text-gray-500" />
                    <span className="text-xs text-gray-600">Treatment</span>
                  </div>
                  <div className="font-medium text-gray-800">
                    {selectedBilling.treatmentOption || selectedBilling.treatment}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 border border-gray-300 p-3 rounded">
                    <div className="text-[10px] text-gray-600 mb-1">Total</div>
                    <div className="font-bold text-gray-800 text-sm">
                      ₱{selectedBilling.totalAmount.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-300 p-3 rounded">
                    <div className="text-[10px] text-gray-600 mb-1">Paid</div>
                    <div className="font-bold text-green-600 text-sm">
                      ₱{selectedBilling.amountPaid.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-300 p-3 rounded">
                    <div className="text-[10px] text-gray-600 mb-1">Balance</div>
                    <div className="font-bold text-red-600 text-sm">
                      ₱{selectedBilling.balance.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Enter amount"
                    max={selectedBilling.balance}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentAmount(
                          (selectedBilling.balance * 0.1).toFixed(2)
                        )
                      }
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs border border-gray-300 rounded transition-colors"
                    >
                      10%
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentAmount(
                          (selectedBilling.balance * 0.2).toFixed(2)
                        )
                      }
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs border border-gray-300 rounded transition-colors"
                    >
                      20%
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentAmount(
                          (selectedBilling.balance / 2).toFixed(2)
                        )
                      }
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs border border-gray-300 rounded transition-colors"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentAmount(selectedBilling.balance.toString())
                      }
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs border border-gray-300 rounded transition-colors"
                    >
                      Full Amount
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="paypal">PayPal</option>
                    <option value="bank-transfer">Bank Transfer</option>
                    <option value="check">Check</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Note (Optional)
                  </label>
                  <textarea
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Add any notes about this payment"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    rows="3"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={closePaymentModal}
                    disabled={submitting}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePaymentSubmit}
                    disabled={submitting}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
                  >
                    {submitting ? "Processing..." : "Submit Payment"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Modal (standalone fallback when viewModal is closed) */}
      
      {/* Invoice Modal (standalone fallback when viewModal is closed) */}
      {invoiceModal && selectedInvoice && !viewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h3 className="text-2xl font-bold text-gray-800">INVOICE</h3>
                <button
                  onClick={() => setInvoiceModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-8 mb-6">
                <div>
                  <h4 className="font-bold text-gray-700 mb-2">Dental Clinic</h4>
                  <p className="text-sm text-gray-600">123 Clinic Street</p>
                  <p className="text-sm text-gray-600">City, Province</p>
                  <p className="text-sm text-gray-600">Phone: (123) 456-7890</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 mb-1">Invoice Date</div>
                  <div className="font-semibold text-gray-800">{new Date().toLocaleDateString()}</div>
                  <div className="text-sm text-gray-600 mt-2">Invoice #</div>
                  <div className="font-semibold text-gray-800">INV-{selectedInvoice.id.substring(0, 8).toUpperCase()}</div>
                </div>
              </div>

              {/* Bill To */}
              <div className="mb-6">
                <h4 className="font-bold text-gray-700 mb-2">Bill To:</h4>
                <p className="text-gray-800 font-medium">{selectedInvoice.patientName}</p>
                <p className="text-sm text-gray-600">Date of Service: {selectedInvoice.dateVisit}</p>
              </div>

              {/* Invoice Details */}
              <table className="w-full mb-6">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-700">Description</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-3">
                      <div className="font-medium text-gray-800">{selectedInvoice.treatment}</div>
                      {selectedInvoice.treatmentOption && (
                        <div className="text-sm text-gray-600">{selectedInvoice.treatmentOption}</div>
                      )}
                    </td>
                    <td className="p-3 text-right font-medium">₱{selectedInvoice.totalAmount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end mb-6">
                <div className="w-64">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">₱{selectedInvoice.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Amount Paid:</span>
                    <span className="font-medium text-green-600">₱{selectedInvoice.amountPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t-2 border-gray-300">
                    <span className="font-bold text-gray-800">Balance Due:</span>
                    <span className="font-bold text-red-600 text-lg">₱{selectedInvoice.balance.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment Status */}
              <div className="mb-6 p-4 bg-gray-50 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Payment Status:</span>
                  {getStatusBadge(selectedInvoice.status)}
                </div>
              </div>

              {/* Footer Note */}
              <div className="text-center text-xs text-gray-500 border-t pt-4">
                Thank you for your business!
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
                <button
                  onClick={() => setInvoiceModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  Close
                </button>

                <button
                  onClick={printInvoice}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm flex items-center gap-2"
                >
                  <Printer size={16} />
                  Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal with optional right-side panels (Invoice / History / Add Payment) */}
      {viewModal && viewBilling && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-[calc(100%-2rem)]">
            <div className="mx-auto grid grid-cols-[1fr_360px] gap-4 items-start">
              {/* Main Billing Details (left) */}
              <div className="bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4 border-b pb-3">
                    <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                      <FileText className="text-blue-600" size={20} />
                      Billing Details
                    </h3>
                    <button
                      onClick={closeViewModal}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Main Grid Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column */}
                    <div className="space-y-4">
                      {/* Patient Info */}
                      <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                        <h4 className="font-semibold text-gray-700 mb-3 text-sm">
                          Patient Information
                        </h4>
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <User size={12} className="text-gray-500" />
                              <span className="text-xs text-gray-600">Name</span>
                            </div>
                            <div className="font-medium text-gray-800 text-sm">
                              {viewBilling.patientName}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar size={12} className="text-gray-500" />
                              <span className="text-xs text-gray-600">Date Visit</span>
                            </div>
                            <div className="font-medium text-gray-800 text-sm">
                              {viewBilling.dateVisit}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Treatment Info */}
                      <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                        <h4 className="font-semibold text-gray-700 mb-3 text-sm">
                          Treatment Information
                        </h4>
                        <div className="flex items-start gap-2">
                          <FileText size={14} className="text-gray-500 mt-0.5" />
                          <div>
                            <div className="font-medium text-gray-800 text-sm">
                              {viewBilling.treatment}
                            </div>
                            {viewBilling.treatmentOption && (
                              <div className="text-xs text-gray-500 mt-1">
                                {viewBilling.treatmentOption}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Billing Summary */}
                      <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                        <h4 className="font-semibold text-gray-700 mb-3 text-sm">
                          Billing Summary
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Total Amount:</span>
                            <span className="font-bold text-gray-800 text-base">
                              ₱{viewBilling.totalAmount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Amount Paid:</span>
                            <span className="font-bold text-green-600 text-base">
                              ₱{viewBilling.amountPaid.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                            <span className="font-semibold text-gray-700">Balance:</span>
                            <span className="font-bold text-red-600 text-lg">
                              ₱{viewBilling.balance.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-sm text-gray-600">Status:</span>
                            <span>{getStatusBadge(viewBilling.status)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Payment History */}
                    <div className="space-y-4">
                      {viewBilling.payments && viewBilling.payments.length > 0 ? (
                        <div className="bg-gray-50 border border-gray-300 p-4 rounded h-full">
                          <h4 className="font-semibold text-gray-700 mb-3 text-sm flex items-center justify-between">
                            <span>Payment History</span>
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                              {viewBilling.payments.length} payment{viewBilling.payments.length > 1 ? 's' : ''}
                            </span>
                          </h4>
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {viewBilling.payments.map((payment, idx) => (
                              <div
                                key={idx}
                                className="bg-white border border-gray-300 p-3 rounded"
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <div className="font-medium text-gray-800 text-sm">
                                      Payment #{idx + 1}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Calendar size={10} className="text-gray-400" />
                                      <span className="text-xs text-gray-600">
                                        {payment.date}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="font-bold text-green-600 text-base">
                                    ₱{payment.amount.toLocaleString()}
                                  </div>
                                </div>
                                <div className="text-xs text-gray-600">
                                  Method: <span className="font-medium">{payment.method || "Cash"}</span>
                                </div>
                                {payment.transactionId && (
                                  <div className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-gray-200 font-mono bg-gray-100 px-2 py-1 rounded">
                                    <span className="font-semibold">TXN ID:</span> {payment.transactionId}
                                  </div>
                                )}
                                {payment.note && (
                                  <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                                    <span className="font-medium">Note:</span> {payment.note}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-300 p-4 rounded h-full flex items-center justify-center">
                          <div className="text-center">
                            <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm text-gray-500">No payment history yet</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-4 mt-4 border-t">
                    <div className="flex gap-2">
                      <button
                        onClick={() => generateInvoice(viewBilling)}
                        className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium flex items-center gap-2"
                        title="Generate Invoice"
                      >
                        <FileText size={14} />
                        Invoice
                      </button>
                      
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={closeViewModal}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                      >
                        Close
                      </button>
                      {viewBilling.balance > 0 && (
                        <button
                          onClick={() => openPaymentModal(viewBilling)}
                          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                          <DollarSign size={16} />
                          Add Payment
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right-side panels container (invoice, history, payment) */}
              <div className="space-y-4">
                {/* Transaction History (when triggered from inside view modal) */}
                {transactionHistoryModal && selectedBilling && (
                  <div className="bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto p-4">
                    <div className="flex items-center justify-between mb-4 border-b pb-3">
                      <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                        <History className="text-purple-600" size={20} />
                        Transaction History - {selectedBilling.patientName}
                      </h3>
                      <button
                        onClick={() => setTransactionHistoryModal(false)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="mb-4 bg-gray-50 border border-gray-300 p-4 rounded">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Total Amount:</span>
                          <div className="font-bold text-gray-800">₱{selectedBilling.totalAmount.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Paid:</span>
                          <div className="font-bold text-green-600">₱{selectedBilling.amountPaid.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Balance:</span>
                          <div className="font-bold text-red-600">₱{selectedBilling.balance.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    {selectedBilling.payments && selectedBilling.payments.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-700 text-sm">All Transactions ({selectedBilling.payments.length})</h4>
                        {selectedBilling.payments.map((payment, idx) => (
                          <div key={idx} className="border border-gray-300 rounded p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-gray-800">Transaction #{idx + 1}</span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    payment.method === 'paypal' 
                                      ? 'bg-blue-100 text-blue-700' 
                                      : 'bg-green-100 text-green-700'
                                  }`}>
                                    {payment.method === 'paypal' ? 'PayPal' : 'Cash'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                                  <Calendar size={12} />
                                  {payment.date}
                                </div>
                                {payment.transactionId && (
                                  <div className="font-mono text-[10px] bg-gray-900 text-white px-3 py-2 rounded border border-gray-700">
                                    <span className="text-gray-300">TXN ID:</span> {payment.transactionId}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-600 text-lg">₱{payment.amount.toLocaleString()}</div>
                              </div>
                            </div>
                            {payment.note && (
                              <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                                <span className="font-medium">Note:</span> {payment.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <History className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No transaction history available</p>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
                      <button
                        onClick={() => setTransactionHistoryModal(false)}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}

                {/* Invoice (when triggered from inside view modal) */}
                {invoiceModal && selectedInvoice && (
                  <div className="bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto p-4">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4 border-b pb-3">
                        <h3 className="text-lg font-bold text-gray-800">INVOICE</h3>
                        <button
                          onClick={() => setInvoiceModal(false)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X size={20} />
                        </button>
                      </div>

                      <div className="mb-4">
                        <div className="text-sm text-gray-600 mb-1">Invoice Date</div>
                        <div className="font-semibold text-gray-800">{new Date().toLocaleDateString()}</div>
                        <div className="text-sm text-gray-600 mt-2">Invoice #</div>
                        <div className="font-semibold text-gray-800">INV-{selectedInvoice.id.substring(0, 8).toUpperCase()}</div>
                      </div>

                      <div className="mb-4">
                        <h4 className="font-bold text-gray-700 mb-2">Bill To:</h4>
                        <p className="text-gray-800 font-medium">{selectedInvoice.patientName}</p>
                        <p className="text-sm text-gray-600">Date of Service: {selectedInvoice.dateVisit}</p>
                      </div>

                      <div className="mb-4">
                        <div className="font-medium text-gray-800">{selectedInvoice.treatment}</div>
                        {selectedInvoice.treatmentOption && (
                          <div className="text-sm text-gray-600">{selectedInvoice.treatmentOption}</div>
                        )}
                        <div className="text-right font-medium mt-2">₱{selectedInvoice.totalAmount.toLocaleString()}</div>
                      </div>

                      <div className="flex justify-end mb-4">
                        <div className="w-full">
                          <div className="flex justify-between py-2 border-b border-gray-200">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-medium">₱{selectedInvoice.totalAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-gray-200">
                            <span className="text-gray-600">Amount Paid:</span>
                            <span className="font-medium text-green-600">₱{selectedInvoice.amountPaid.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between py-3 border-t-2 border-gray-300">
                            <span className="font-bold text-gray-800">Balance Due:</span>
                            <span className="font-bold text-red-600 text-lg">₱{selectedInvoice.balance.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4 p-2 bg-gray-50 rounded">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Payment Status:</span>
                          {getStatusBadge(selectedInvoice.status)}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setInvoiceModal(false)}
                          className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-xs"
                        >
                          Close
                        </button>
                       
                        <button
                          onClick={printInvoice}
                          className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs"
                        >
                          <Printer size={14} />
                          Print
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add Payment panel when opened from within Billing Details */}
                {paymentModal && selectedBilling && (
                  <div className="bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto p-4">
                    <div className="flex items-center justify-between mb-4 border-b pb-3">
                      <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                        <DollarSign className="text-green-600" size={20} />
                        Add Payment
                      </h3>
                      <button
                        onClick={closePaymentModal}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-gray-50 border border-gray-300 p-3 rounded">
                        <div className="flex items-center gap-2 mb-2">
                          <User size={14} className="text-gray-500" />
                          <span className="text-xs text-gray-600">Patient</span>
                        </div>
                        <div className="font-medium text-gray-800">
                          {selectedBilling.patientName}
                        </div>
                      </div>

                      <div className="bg-gray-50 border border-gray-300 p-3 rounded">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText size={14} className="text-gray-500" />
                          <span className="text-xs text-gray-600">Treatment</span>
                        </div>
                        <div className="font-medium text-gray-800">
                          {selectedBilling.treatmentOption || selectedBilling.treatment}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-50 border border-gray-300 p-3 rounded">
                          <div className="text-[10px] text-gray-600 mb-1">Total</div>
                          <div className="font-bold text-gray-800 text-sm">
                            ₱{selectedBilling.totalAmount.toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-green-50 border border-green-300 p-3 rounded">
                          <div className="text-[10px] text-gray-600 mb-1">Paid</div>
                          <div className="font-bold text-green-600 text-sm">
                            ₱{selectedBilling.amountPaid.toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-red-50 border border-red-300 p-3 rounded">
                          <div className="text-[10px] text-gray-600 mb-1">Balance</div>
                          <div className="font-bold text-red-600 text-sm">
                            ₱{selectedBilling.balance.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Amount <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="Enter amount"
                          max={selectedBilling.balance}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPaymentAmount(
                                (selectedBilling.balance * 0.1).toFixed(2)
                              )
                            }
                            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs border border-gray-300 rounded transition-colors"
                          >
                            10%
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPaymentAmount(
                                (selectedBilling.balance * 0.2).toFixed(2)
                              )
                            }
                            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs border border-gray-300 rounded transition-colors"
                          >
                            20%
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPaymentAmount(
                                (selectedBilling.balance / 2).toFixed(2)
                              )
                            }
                            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs border border-gray-300 rounded transition-colors"
                          >
                            50%
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPaymentAmount(selectedBilling.balance.toString())
                            }
                            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs border border-gray-300 rounded transition-colors"
                          >
                            Full Amount
                          </button>
                        </div>
                      </div>

                      
                      <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                          onClick={closePaymentModal}
                          disabled={submitting}
                          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handlePaymentSubmit}
                          disabled={submitting}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                          {submitting ? "Processing..." : "Submit Payment"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Animation CSS */
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
  
  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
`;
document.head.appendChild(style);