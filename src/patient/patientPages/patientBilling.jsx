import React, { useState, useEffect } from "react";
import { User, Calendar, FileText, CheckCircle, XCircle, Clock, DollarSign, Receipt, X, CreditCard, AlertTriangle } from "lucide-react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../../../firebase.config";
import { onAuthStateChanged } from "firebase/auth";
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

// ============ TRANSACTION ID VALIDATOR ============
// Normalizes transaction IDs from different sources for consistency
function normalizeTransactionId(txId, source = 'unknown') {
  if (!txId) return null;
  // PayPal IDs or standard format IDs are used as-is
  return String(txId).trim();
}

// ============ SMS SENDING FUNCTION ============
const sendBillingPaymentSMS = async (paymentData) => {
  try {
    // Get patient's phone number from users collection
    const usersRef = collection(db, "users");
    const userQuery = query(
      usersRef,
      where("email", "==", (paymentData.payerEmail || paymentData.userEmail || "").toLowerCase())
    );
    const userSnapshot = await getDocs(userQuery);
    
    let phoneNumber = null;
    if (!userSnapshot.empty) {
      const userData = userSnapshot.docs[0].data();
      phoneNumber = userData.contactNumber || userData.phoneNumber || userData.phone;
    }

    if (!phoneNumber) {
      console.log("No phone number found for patient, skipping SMS");
      return { success: false, reason: "No phone number" };
    }

    // Create SMS message for payment
    const patientName = paymentData.payerName || paymentData.userName || "Patient";
    const amount = paymentData.amount || 0;
    const treatment = paymentData.treatment || "your appointment";
    const txId = paymentData.transactionId || paymentData.txId || "";
    const paymentTime = paymentData.paymentTime || new Date().toLocaleString();

    const message = `Hi ${patientName}! Payment received on ${paymentTime}. Amount: ₱${amount} for ${treatment}. Transaction ID: ${txId}. Thank you for choosing our clinic! - Dental Clinic`;

    // Send SMS via API
    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: phoneNumber,
        message: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SMS API Error:", errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log("Payment SMS sent successfully:", data);
    return { success: true, data };

  } catch (error) {
    console.error("Error sending payment SMS:", error);
    return { success: false, error: error.message };
  }
};

export default function PatientBilling() {
  const [billings, setBillings] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentModal, setPaymentModal] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("paypal");
  const [userPhone, setUserPhone] = useState("");
  
  // PayPal Configuration - Same as PatientAppointment.jsx
  const PAYPAL_CLIENT_ID = "AQ7EOFkdAiFb_I8zfNh68kltLYpMD0TbvVeW212iPAd_iAivDQ1mYSqF6ATOEVPk_kbvPLQRx7sVWV_c";
  const isPayPalEnabled = PAYPAL_CLIENT_ID && PAYPAL_CLIENT_ID.length > 0;

  // Listen to auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        // Retrieve user's phone number
        const userRef = collection(db, "users");
        const phoneQuery = query(
          userRef,
          where("email", "==", user.email.toLowerCase())
        );
        getDocs(phoneQuery).then((snapshot) => {
          if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            const phone = userData.contactNumber || userData.phoneNumber || userData.phone || "";
            setUserPhone(phone);
          }
        });
      } else {
        setUserId(null);
        setBillings([]);
        setUserPhone("");
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Load user's billing records
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const unsubscribers = [];

    // Query appointments for treated appointments
    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("userId", "==", userId),
      where("status", "==", "treated")
    );
    
    const unsubAppointments = onSnapshot(appointmentsQuery, (appointmentsSnap) => {
      const appointmentBillings = appointmentsSnap.docs.map((d) => {
        const data = d.data();
        const treatmentName = data.treatmentOption || data.treatment || "";
        const price = data.price || getTreatmentPrice(treatmentName);
        
        // Use amountPaid field directly from admin billing system
        const amountPaid = data.amountPaid || 0;
        const balance = price - amountPaid;
        
        // Build payments array from payments field (as stored by admin)
        const payments = data.payments || [];
        
        return {
          id: d.id,
          source: "appointment",
          dateVisit: data.date || "N/A",
          treatment: data.treatment || "N/A",
          treatmentOption: data.treatmentOption || "",
          totalAmount: price,
          amountPaid: amountPaid,
          balance: Math.max(0, balance),
          status: data.paymentStatus || (balance <= 0 ? "paid" : amountPaid > 0 ? "partial" : "unpaid"),
          payments: payments,
          createdAt: data.createdAt,
        };
      });

      // Query onlineRequests for treated appointments
      const onlineQuery = query(
        collection(db, "onlineRequests"),
        where("userId", "==", userId),
        where("status", "==", "treated")
      );
      
      const unsubOnline = onSnapshot(onlineQuery, (onlineSnap) => {
        const onlineBillings = onlineSnap.docs.map((d) => {
          const data = d.data();
          const treatmentName = data.treatmentOption || data.treatment || "";
          const price = data.price || getTreatmentPrice(treatmentName);
          
          // Use amountPaid field directly from admin billing system
          const amountPaid = data.amountPaid || 0;
          const balance = price - amountPaid;
          
          // Build payments array from payments field (as stored by admin)
          const payments = data.payments || [];
          
          return {
            id: d.id,
            source: "onlineRequest",
            dateVisit: data.date || "N/A",
            treatment: data.treatment || "N/A",
            treatmentOption: data.treatmentOption || "",
            totalAmount: price,
            amountPaid: amountPaid,
            balance: Math.max(0, balance),
            status: data.paymentStatus || (balance <= 0 ? "paid" : amountPaid > 0 ? "partial" : "unpaid"),
            payments: payments,
            createdAt: data.createdAt,
          };
        });

        const allBillings = [...appointmentBillings, ...onlineBillings];
        // Sort by date descending
        allBillings.sort((a, b) => {
          const dateA = new Date(a.dateVisit);
          const dateB = new Date(b.dateVisit);
          return dateB - dateA;
        });
        
        setBillings(allBillings);
        setLoading(false);
      });

      unsubscribers.push(unsubOnline);
    });

    unsubscribers.push(unsubAppointments);

    return () => {
      unsubscribers.forEach((unsub) => unsub && unsub());
    };
  }, [userId]);

  // Open payment modal
  function openPaymentModal(billing) {
    setSelectedBilling(billing);
    setPaymentAmount(billing.balance.toString());
    setPaymentMethod("paypal");
    setPaymentModal(true);
  }

  // Close payment modal
  function closePaymentModal() {
    setPaymentModal(false);
    setSelectedBilling(null);
    setPaymentAmount("");
    setPaymentMethod("paypal");
  }

  // Handle PayPal payment success
  async function handlePayPalSuccess(details, data) {
    try {
      const amount = parseFloat(paymentAmount);
      
      const newAmountPaid = selectedBilling.amountPaid + amount;
      const newBalance = selectedBilling.totalAmount - newAmountPaid;
      const newStatus = newBalance <= 0 ? "paid" : "partial";

      const collectionName = selectedBilling.source === "appointment" ? "appointments" : "onlineRequests";
      const docRef = doc(db, collectionName, selectedBilling.id);

      // Create payment record in the same format as admin
      // Use PayPal's transaction ID directly for consistency
      const paypalTransactionId = normalizeTransactionId(details.id, 'paypal');
      
      const newPayment = {
        amount: amount,
        date: new Date().toISOString().split("T")[0],
        method: "paypal",
        gateway: "paypal",
        transactionId: paypalTransactionId,
        txId: paypalTransactionId,
        payerEmail: details.payer.email_address,
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      // Update with both old structure (for compatibility) and new structure (admin billing)
      await updateDoc(docRef, {
        amountPaid: newAmountPaid,
        balance: newBalance,
        paymentStatus: newStatus,
        status: "treated", // Keep as treated, not "paid"
        payments: [...(selectedBilling.payments || []), newPayment],
        // Also update paymentsSummary for backward compatibility
        paymentsSummary: {
          treatment: {
            amount: newAmountPaid,
            gateway: "paypal",
            txId: details.id,
            payerEmail: details.payer.email_address,
            paidAt: new Date().toISOString(),
          }
        },
        updatedAt: serverTimestamp(),
      });

      // ============ CREATE PAYMENT NOTIFICATION ============
      await addDoc(collection(db, "notifications"), {
        userId: user.uid,
        type: "payment_reminder",
        title: "Payment Successful",
        message: `Your payment of ₱${amount.toFixed(2)} for ${selectedBilling.treatment} has been processed successfully. Your remaining balance is ₱${Math.max(0, newBalance).toFixed(2)}.`,
        read: false,
        details: {
          billingId: docRef.id,
          amount: amount,
          treatment: selectedBilling.treatment,
          method: "paypal",
          transactionId: details.id,
          newBalance: Math.max(0, newBalance),
          paymentStatus: newStatus,
        },
        createdAt: serverTimestamp(),
      });

      // ============ SEND SMS NOTIFICATION ============
      const paymentDate = new Date();
      const paymentTime = paymentDate.toLocaleString('en-PH', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      
      const paymentData = {
        payerEmail: details.payer.email_address,
        payerName: details.payer.name.given_name + " " + details.payer.name.surname,
        amount: amount,
        treatment: selectedBilling.treatment,
        transactionId: details.id,
        txId: details.id,
        paymentTime: paymentTime,
      };
      
      const smsResult = await sendBillingPaymentSMS(paymentData);
      if (smsResult.success) {
        toast.success("📱 Payment receipt SMS sent!");
      } else {
        console.log("SMS not sent:", smsResult.reason || smsResult.error);
        // Don't block payment success if SMS fails
      }

      toast.success("Payment successful via PayPal!");
      closePaymentModal();
    } catch (err) {
      console.error("Payment update error:", err);
      toast.error("Failed to update payment record");
    }
  }

  // Filter billings
  const filteredBillings = billings.filter((b) => {
    if (statusFilter === "All") return true;
    if (statusFilter === "Paid") return b.status === "paid";
    if (statusFilter === "Remaining") return b.status === "partial" || b.status === "unpaid";
    return true;
  });

  // Count by status
  const allCount = billings.length;
  const paidCount = billings.filter((b) => b.status === "paid").length;
  const remainingCount = billings.filter((b) => b.status === "partial" || b.status === "unpaid").length;

  // Calculate totals
  const totalAmount = billings.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalPaid = billings.reduce((sum, b) => sum + b.amountPaid, 0);
  const totalBalance = billings.reduce((sum, b) => sum + b.balance, 0);

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

  const BillingContent = () => (
    <div className="min-h-screen bg-gray-100 p-4">
      <ToastContainer position="top-right" autoClose={3000} />

        <div className="max-w-[1400px] mx-auto space-y-4">
          
          {/* Overall Remaining Balance - Highlighted */}
          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded border-2 border-red-700 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="text-white" size={28} />
                </div>
                <div>
                  <h2 className="text-white text-sm font-medium mb-1">Overall Remaining Balance</h2>
                  <p className="text-white/80 text-xs">Total amount you need to pay</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-white">
                  ₱{totalBalance.toLocaleString()}
                </div>
                <p className="text-white/80 text-xs mt-1">
                  from {remainingCount} bill{remainingCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div className="bg-white rounded border border-gray-300 p-4">
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setStatusFilter("All")}
                className={`border-2 rounded p-3 text-center transition-all ${
                  statusFilter === "All"
                    ? "border-gray-500 bg-gray-50"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="text-2xl font-bold text-gray-700">{allCount}</div>
                <div className="text-xs text-gray-600 font-semibold mt-1">
                  TOTAL BILLS
                </div>
              </button>

              <button
                onClick={() => setStatusFilter("Paid")}
                className={`border-2 rounded p-3 text-center transition-all ${
                  statusFilter === "Paid"
                    ? "border-green-500 bg-green-50"
                    : "border-green-300 hover:bg-green-50"
                }`}
              >
                <div className="text-2xl font-bold text-green-600">
                  {paidCount}
                </div>
                <div className="text-xs text-gray-600 font-semibold mt-1">
                  PAID
                </div>
              </button>

              <button
                onClick={() => setStatusFilter("Remaining")}
                className={`border-2 rounded p-3 text-center transition-all ${
                  statusFilter === "Remaining"
                    ? "border-red-500 bg-red-50"
                    : "border-red-300 hover:bg-red-50"
                }`}
              >
                <div className="text-2xl font-bold text-red-600">
                  {remainingCount}
                </div>
                <div className="text-xs text-gray-600 font-semibold mt-1">
                  REMAINING BILLS
                </div>
              </button>
            </div>
          </div>

          {/* Billing Records */}
          {filteredBillings.length === 0 ? (
            <div className="bg-white rounded border border-gray-300 p-12 text-center">
              <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No bills found</h3>
              <p className="text-gray-500">
                {statusFilter !== "All" 
                  ? `You don't have any ${statusFilter.toLowerCase()} bills` 
                  : "You don't have any billing records yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBillings.map((billing) => (
                <div 
                  key={billing.id}
                  className="bg-white rounded border border-gray-300 hover:border-blue-400 transition-all"
                >
                  <div className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      
                      {/* Left: Treatment Info */}
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <FileText className="text-blue-600" size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-800 text-base">
                              {billing.treatment}
                            </h3>
                            {billing.treatmentOption && (
                              <p className="text-sm text-gray-600 mt-0.5">
                                {billing.treatmentOption}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Calendar size={14} className="text-gray-400" />
                              <span className="text-xs text-gray-600">
                                {billing.dateVisit}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Payment Info */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs text-gray-600 mb-1">Total Amount</div>
                          <div className="text-lg font-bold text-gray-800">
                            ₱{billing.totalAmount.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-600 mb-1">Paid</div>
                          <div className="text-lg font-bold text-green-600">
                            ₱{billing.amountPaid.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-600 mb-1">Balance</div>
                          <div className="text-lg font-bold text-red-600">
                            ₱{billing.balance.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {getStatusBadge(billing.status)}
                          {billing.balance > 0 && (
                            <button
                              onClick={() => openPaymentModal(billing)}
                              className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
                            >
                              <CreditCard size={12} />
                              Pay Now
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Payment History (if exists) */}
                    {billing.payments && billing.payments.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center gap-2 mb-3">
                          <DollarSign size={14} className="text-gray-400" />
                          <span className="text-xs font-semibold text-gray-700">
                            Payment History ({billing.payments.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {billing.payments.map((payment, idx) => (
                            <div 
                              key={idx}
                              className="bg-gray-50 border border-gray-200 rounded p-3"
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-xs text-gray-600">
                                  Payment #{idx + 1}
                                </span>
                                <span className="text-sm font-bold text-green-600">
                                  ₱{payment.amount.toLocaleString()}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {payment.date}
                              </div>
                              {payment.method && (
                                <div className="text-xs text-gray-500 mt-1">
                                  via {payment.method === 'paypal' ? 'PayPal' : payment.gateway === 'paypal' ? 'PayPal' : 'Cash'}
                                </div>
                              )}
                              {payment.transactionId && (
                                <div className="text-[10px] font-mono bg-gray-900 text-white mt-2 px-2 py-1 rounded border border-gray-700 break-all">
                                  <span className="text-gray-300">TXN:</span> {payment.transactionId}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Modal with PayPal */}
        {paymentModal && selectedBilling && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4 border-b pb-3">
                  <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                    <CreditCard className="text-blue-600" size={20} />
                    Make Payment
                  </h3>
                  <button
                    onClick={closePaymentModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Billing Info */}
                  <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                    <h4 className="font-semibold text-gray-700 mb-2 text-sm">
                      Treatment Details
                    </h4>
                    <div className="space-y-1">
                      <div className="text-sm text-gray-800 font-medium">
                        {selectedBilling.treatment}
                      </div>
                      {selectedBilling.treatmentOption && (
                        <div className="text-xs text-gray-600">
                          {selectedBilling.treatmentOption}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                        <Calendar size={12} />
                        {selectedBilling.dateVisit}
                      </div>
                      {userPhone && (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                          <User size={12} />
                          {userPhone}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 border border-gray-300 p-3 rounded text-center">
                      <div className="text-[10px] text-gray-600 mb-1">Total</div>
                      <div className="font-bold text-gray-800 text-sm">
                        ₱{selectedBilling.totalAmount.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-green-50 border border-green-300 p-3 rounded text-center">
                      <div className="text-[10px] text-gray-600 mb-1">Paid</div>
                      <div className="font-bold text-green-600 text-sm">
                        ₱{selectedBilling.amountPaid.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-red-50 border border-red-300 p-3 rounded text-center">
                      <div className="text-[10px] text-gray-600 mb-1">Balance</div>
                      <div className="font-bold text-red-600 text-sm">
                        ₱{selectedBilling.balance.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Payment Amount */}
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
                        onClick={() => setPaymentAmount((selectedBilling.balance / 2).toFixed(2))}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs border border-gray-300 rounded transition-colors"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(selectedBilling.balance.toString())}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs border border-gray-300 rounded transition-colors"
                      >
                        Full Amount
                      </button>
                    </div>
                  </div>

                  {/* PayPal Buttons */}
                  <div className="pt-4 border-t">
                    {!isPayPalEnabled ? (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={16} className="text-yellow-600 mt-0.5" />
                          <div className="text-sm text-yellow-800">
                            <p className="font-semibold mb-1">PayPal Not Configured</p>
                            <p className="text-xs">Please add your PayPal Client ID in the code to enable online payments.</p>
                            <p className="text-xs mt-2">For now, please pay at the clinic directly.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                          <CreditCard size={14} className="inline mr-1" />
                          Secure payment via PayPal
                        </div>
                        
                        <PayPalButtons
                          createOrder={(data, actions) => {
                            const amount = parseFloat(paymentAmount);
                            if (!amount || amount <= 0 || amount > selectedBilling.balance) {
                              toast.error("Please enter a valid payment amount");
                              return Promise.reject();
                            }
                            return actions.order.create({
                              purchase_units: [{
                                amount: {
                                  value: amount.toFixed(2),
                                  currency_code: "PHP"
                                },
                                description: `Payment for ${selectedBilling.treatment}`
                              }]
                            });
                          }}
                          onApprove={(data, actions) => {
                            return actions.order.capture().then((details) => {
                              handlePayPalSuccess(details, data);
                            });
                          }}
                          onError={(err) => {
                            console.error("PayPal error:", err);
                            toast.error("Payment failed. Please try again.");
                          }}
                          style={{
                            layout: "vertical",
                            color: "blue",
                            shape: "rect",
                            label: "paypal"
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  return isPayPalEnabled ? (
    <PayPalScriptProvider options={{ 
      "client-id": PAYPAL_CLIENT_ID,
      currency: "PHP"
    }}>
      <BillingContent />
    </PayPalScriptProvider>
  ) : (
    <BillingContent />
  );
}
