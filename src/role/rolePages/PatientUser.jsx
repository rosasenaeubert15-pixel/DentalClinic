import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import {
  Pencil,
  Trash2,
  Plus,
  CheckCircle,
  X,
  RefreshCw,
  Mail,
  User,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Eye,
} from "lucide-react";
import { db, functions, auth } from "../../../firebase.config";

export default function AdminUserPatient() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [returnedLink, setReturnedLink] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Table controls
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [globalSearch, setGlobalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const emptyForm = {
    uid: null,
    firstName: "",
    lastName: "",
    address: "",
    contactNumber: "",
    email: "",
    password: "",
    confirmPassword: "",
    status: "Active",
    emailVerified: false,
    imageName: "",
    agreeTerms: true,
  };
  const [form, setForm] = useState(emptyForm);

  // Subscribe to realtime patients from Firebase
  useEffect(() => {
    setLoading(true);
    const col = collection(db, "users");
    const unsub = onSnapshot(
      col,
      (snap) => {
        const arr = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((u) => (u.role || "").toLowerCase() === "patient");
        arr.sort((a, b) => {
          const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bt - at;
        });
        setPatients(arr);
        setLoading(false);
      },
      (err) => {
        setError("Subscription error: " + (err?.message || err));
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Auto-generate password
  useEffect(() => {
    if (!editing && form.lastName && form.contactNumber) {
      const last4 = form.contactNumber.slice(-4);
      if (last4.length === 4 && /^\d{4}$/.test(last4)) {
        const autoPassword = `${form.lastName}${last4}@abeledo`;
        setForm((prev) => ({
          ...prev,
          password: autoPassword,
          confirmPassword: autoPassword,
        }));
      }
    }
  }, [form.lastName, form.contactNumber, editing]);

  const filtered = useMemo(() => {
    let result = patients;

    // Status filter
    if (statusFilter !== "All") {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Search filter
    const s = globalSearch.trim().toLowerCase();
    if (s) {
      result = result.filter(
        (p) =>
          (p.firstName || "").toLowerCase().includes(s) ||
          (p.lastName || "").toLowerCase().includes(s) ||
          (p.email || "").toLowerCase().includes(s) ||
          (p.contactNumber || "").toLowerCase().includes(s)
      );
    }

    return result;
  }, [patients, globalSearch, statusFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  // Count by status
  const allCount = patients.length;
  const activeCount = patients.filter((p) => p.status === "Active").length;
  const inactiveCount = patients.filter((p) => p.status === "Inactive").length;
  const verifiedCount = patients.filter((p) => p.emailVerified).length;
  const unverifiedCount = patients.filter((p) => !p.emailVerified).length;

  function handleFormChange(e) {
    const { name, value, files, type, checked } = e.target;
    if (name === "imageFile") {
      setForm((p) => ({ ...p, imageName: files?.[0]?.name || "" }));
    } else if (type === "checkbox") {
      setForm((p) => ({ ...p, [name]: checked }));
    } else if (name === "contactNumber") {
      let cleaned = value.replace(/\D/g, "");
      if (cleaned.startsWith("63")) {
        cleaned = cleaned.slice(2);
      }
      if (cleaned.length > 10) {
        cleaned = cleaned.slice(0, 10);
      }
      const formatted = cleaned ? `+63${cleaned}` : "";
      setForm((p) => ({ ...p, [name]: formatted }));
    } else {
      setForm((p) => ({ ...p, [name]: value }));
    }
  }

  function passwordChecks(password = "") {
    return {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>_\-\[\]=+;\/~`]/.test(password),
    };
  }

  function passwordScore(checks) {
    return ["length", "upper", "lower", "number", "special"].reduce(
      (s, k) => s + (checks[k] ? 1 : 0),
      0
    );
  }

  function scoreLabel(score) {
    if (score <= 2)
      return { text: "Weak", color: "text-rose-600", bar: "bg-rose-500" };
    if (score === 3)
      return { text: "Medium", color: "text-amber-600", bar: "bg-amber-500" };
    return { text: "Strong", color: "text-cyan-600", bar: "bg-cyan-600" };
  }

  const regChecks = passwordChecks(form.password);
  const regScore = passwordScore(regChecks);
  const regScoreInfo = scoreLabel(regScore);
  const regProgress = Math.round((regScore / 5) * 100);

  function clearMessages() {
    setError("");
    setSuccessMsg("");
    setReturnedLink("");
  }

  function extractErrorMessage(err) {
    if (!err) return "Unknown error";
    if (err?.details) return String(err.details);
    if (err?.message) return String(err.message);
    if (err?.code) return String(err.code);
    return String(err);
  }

  function isValidEmail(e) {
    return (
      typeof e === "string" &&
      e.length > 5 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
    );
  }

  /**
   * handleCreate - Matches WebsiteApp.jsx registration exactly:
   * 1. Creates user with createUserWithEmailAndPassword
   * 2. Stores in "users" collection with uid as document ID
   * 3. Sends verification email
   * 4. Signs out admin
   * 5. Patient must verify email before login
   */
  async function handleCreate(e) {
    e.preventDefault();
    clearMessages();

    // Validation (same as WebsiteApp.jsx)
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Please provide the patient's full name.");
      return;
    }
    if (!isValidEmail(form.email)) {
      setError("Please provide a valid email.");
      return;
    }
    if (!form.contactNumber?.trim() || form.contactNumber.length !== 13) {
      setError(
        "Contact number must be +63 followed by 10 digits (e.g., +639123456789)"
      );
      return;
    }
    if (!form.address?.trim()) {
      setError("Please provide an address.");
      return;
    }
    if (regScore < 3) {
      setError("Choose a stronger password (at least 3/5).");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitLoading(true);
    try {
      // EXACT same flow as WebsiteApp.jsx
      const cred = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password
      );
      const user = cred.user;

      if (!user?.uid) {
        throw new Error("No user returned from createUserWithEmailAndPassword");
      }

      // Store in "users" collection with uid as document ID
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          address: form.address.trim(),
          contactNumber: form.contactNumber.trim(),
          email: form.email.trim().toLowerCase(),
          role: "patient",
          status: form.status || "Active",
          emailVerified: user.emailVerified || false,
          imageName: form.imageName || "",
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch((e) => {
        console.warn("setDoc error:", e);
        throw new Error("Failed to save patient data: " + e.message);
      });

      // Send verification email
      await sendEmailVerification(user).catch((e) => {
        console.warn("sendEmailVerification error:", e);
      });

      // Sign out admin (IMPORTANT: to avoid confusion)
      try {
        await signOut(auth);
      } catch (e) {
        console.warn("signOut after patient creation:", e);
      }

      setForm(emptyForm);
      setShowModal(false);
      setSuccessMsg(
        "Patient account created successfully! Verification email sent. Note: You were signed out - please sign back in as admin. Patient must verify email before login."
      );
      setTimeout(() => setSuccessMsg(""), 10000);
    } catch (err) {
      console.error("handleCreate error:", err);
      const msg = extractErrorMessage(err);

      if (err?.code === "auth/email-already-in-use") {
        setError("Email already registered. Try a different email.");
      } else if (err?.code === "auth/weak-password") {
        setError("Password is too weak.");
      } else {
        setError(msg || "Failed to create patient account.");
      }
    } finally {
      setSubmitLoading(false);
    }
  }

  function startEdit(patient) {
    clearMessages();
    setEditing(true);
    setShowModal(true);
    setForm({
      uid: patient.uid,
      firstName: patient.firstName || "",
      lastName: patient.lastName || "",
      address: patient.address || "",
      contactNumber: patient.contactNumber || "",
      email: patient.email || "",
      password: "",
      confirmPassword: "",
      status: patient.status || "Active",
      emailVerified: !!patient.emailVerified,
      imageName: patient.imageName || "",
      agreeTerms: true,
    });
  }

  async function handleUpdate(e) {
    e.preventDefault();
    clearMessages();
    if (!form.uid) return setError("Missing uid.");
    setSubmitLoading(true);
    try {
      await updateDoc(doc(db, "users", form.uid), {
        firstName: form.firstName,
        lastName: form.lastName,
        address: form.address,
        contactNumber: form.contactNumber,
        email: form.email,
        status: form.status || "Active",
        updatedAt: new Date().toISOString(),
      });
      setEditing(false);
      setForm(emptyForm);
      setShowModal(false);
      setSuccessMsg("Patient updated successfully");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      setError(extractErrorMessage(err));
      console.error("update error:", err);
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleDelete(uid) {
    clearMessages();
    if (
      !window.confirm(
        "Delete this patient? This will remove their account permanently from both Firestore and Authentication."
      )
    )
      return;

    setSubmitLoading(true);
    try {
      // First, delete from Authentication using Cloud Function (required for deleting other users)
      if (functions) {
        try {
          const deleteUser = httpsCallable(functions, "deleteUser");
          await deleteUser({ uid });
        } catch (fnErr) {
          console.warn("deleteUser callable failed:", fnErr?.message || fnErr);
          // Continue to delete from Firestore even if auth deletion fails
        }
      }

      // Then delete from Firestore
      await deleteDoc(doc(db, "users", uid));

      setSuccessMsg(
        "Patient deleted successfully from Firestore and Authentication"
      );
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Delete error:", err);
      setError("Failed to delete patient: " + extractErrorMessage(err));
    } finally {
      setSubmitLoading(false);
    }
  }

  async function toggleStatus(uid, current) {
    clearMessages();
    if (!uid) return;
    const next = current === "Active" ? "Inactive" : "Active";
    try {
      await updateDoc(doc(db, "users", uid), {
        status: next,
        updatedAt: new Date().toISOString(),
      });
      if (functions) {
        try {
          const setUserDisabled = httpsCallable(functions, "setUserDisabled");
          await setUserDisabled({ uid, disabled: next !== "Active" });
        } catch (fnErr) {
          console.warn(
            "setUserDisabled callable failed:",
            fnErr?.message || fnErr
          );
        }
      }
      setSuccessMsg(`Status updated to ${next}`);
      setTimeout(() => setSuccessMsg(""), 2500);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }



  function openDetailsModal(patient) {
    setSelectedPatient(patient);
    setShowDetailsModal(true);
  }

  function initials(firstName, lastName) {
    const name = `${firstName || ""} ${lastName || ""}`.trim();
    if (!name) return "?";
    return name
      .split(" ")
      .map((s) => s[0] || "")
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        pages.push(page - 1);
        pages.push(page);
        pages.push(page + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Success Message */}
      {successMsg && (
        <div className="mb-4 max-w-[1400px] mx-auto">
          <div className="rounded-md bg-green-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} />
              <div className="font-medium">{successMsg}</div>
            </div>
            <button
              className="opacity-90 hover:opacity-100"
              onClick={() => {
                setSuccessMsg("");
                setReturnedLink("");
              }}
            >
              <X size={18} />
            </button>
          </div>
          {returnedLink && (
            <div className="mt-2 text-sm">
              <div className="bg-white border rounded px-3 py-2 flex items-center justify-between">
                <div className="truncate mr-3">{returnedLink}</div>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 border rounded text-sm">
                    Copy Link
                  </button>
                  <a
                    href={returnedLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 bg-slate-800 text-white rounded text-sm"
                  >
                    Open Link
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Status Cards */}
        <div className="bg-white rounded border border-gray-300 p-4">
          <div className="grid grid-cols-5 gap-3">
            <button
              onClick={() => setStatusFilter("All")}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === "All"
                  ? "border-gray-500 bg-gray-50"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="text-2xl font-bold text-gray-700">{allCount}</div>
              <div className="text-[10px] text-gray-600 font-semibold mt-1">
                ALL PATIENTS
              </div>
            </button>

            <button
              onClick={() => setStatusFilter("Active")}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === "Active"
                  ? "border-green-500 bg-green-50"
                  : "border-green-300 hover:bg-green-50"
              }`}
            >
              <div className="text-2xl font-bold text-green-600">
                {activeCount}
              </div>
              <div className="text-[10px] text-gray-600 font-semibold mt-1">
                ACTIVE
              </div>
            </button>

            <button
              onClick={() => setStatusFilter("Inactive")}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === "Inactive"
                  ? "border-red-500 bg-red-50"
                  : "border-red-300 hover:bg-red-50"
              }`}
            >
              <div className="text-2xl font-bold text-red-600">
                {inactiveCount}
              </div>
              <div className="text-[10px] text-gray-600 font-semibold mt-1">
                INACTIVE
              </div>
            </button>

            <div className="border-2 border-blue-300 rounded p-3 text-center bg-blue-50">
              <div className="text-2xl font-bold text-blue-600">
                {verifiedCount}
              </div>
              <div className="text-[10px] text-gray-600 font-semibold mt-1">
                VERIFIED
              </div>
            </div>

            <div className="border-2 border-orange-300 rounded p-3 text-center bg-orange-50">
              <div className="text-2xl font-bold text-orange-600">
                {unverifiedCount}
              </div>
              <div className="text-[10px] text-gray-600 font-semibold mt-1">
                UNVERIFIED
              </div>
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded border border-gray-300 p-4">
          {/* Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Show</span>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-gray-400 rounded px-2 py-1 text-xs bg-white"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
              <span className="text-xs text-gray-600">entries</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search patients..."
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setPage(1);
                }}
                className="border border-gray-400 rounded px-3 py-1 text-xs w-64 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
              />
              <button
                onClick={() => {
                  clearMessages();
                  setEditing(false);
                  setForm(emptyForm);
                  setShowModal(true);
                }}
                className="bg-red-600 text-white px-3 py-1.5 rounded flex items-center gap-2 hover:bg-red-700 text-xs font-medium"
              >
                <Plus size={14} />
                Add Patient
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-400 rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b border-gray-400">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Photo
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Name
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Contact
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Email
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      {loading ? "Loading..." : "No patients found"}
                    </td>
                  </tr>
                ) : (
                  paginated.map((p) => (
                    <tr
                      key={p.uid}
                      onClick={() => openDetailsModal(p)}
                      className="border-b border-gray-300 hover:bg-blue-50 cursor-pointer transition-colors"
                      title="Click to view details"
                    >
                      <td className="px-3 py-2 border-r border-gray-200">
                        {p.avatarUrl ? (
                          <img
                            src={p.avatarUrl}
                            alt={`${p.firstName} ${p.lastName}`}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-semibold text-sm shadow">
                            {initials(p.firstName, p.lastName)}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2 border-r border-gray-200">
                        <div className="font-medium text-gray-800">
                          {`${p.firstName || ""} ${p.lastName || ""}`.trim()}
                        </div>
                      </td>

                      <td className="px-3 py-2 border-r border-gray-200">
                        <div className="text-gray-700">{p.contactNumber}</div>
                      </td>

                      <td className="px-3 py-2 border-r border-gray-200">
                        <div className="text-gray-700">{p.email}</div>
                        {p.emailVerified && (
                          <div className="flex items-center gap-1 mt-1">
                            <CheckCircle size={10} className="text-green-600" />
                            <span className="text-[10px] text-green-600">
                              Verified
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            p.status === "Active"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {p.status || "Active"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-gray-700">
              Showing <span className="font-medium">{total === 0 ? 0 : (page - 1) * perPage + 1}</span> to{" "}
              <span className="font-medium">{Math.min(page * perPage, total)}</span> of{" "}
              <span className="font-medium">{total}</span> entries
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs border border-gray-400 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <div className="flex gap-1">
                {getPageNumbers().map((pageNum, idx) =>
                  pageNum === "..." ? (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs">
                      ...
                    </span>
                  ) : (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1 text-xs border rounded ${
                        page === pageNum
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-400 hover:bg-gray-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-xs border border-gray-400 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-300 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {initials(selectedPatient.firstName, selectedPatient.lastName)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                      selectedPatient.status === "Active"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedPatient.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Contact Information */}
                <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Mail className="text-blue-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Email</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedPatient.email}
                        </p>
                        {selectedPatient.emailVerified && (
                          <div className="flex items-center gap-1 mt-1">
                            <CheckCircle size={12} className="text-green-600" />
                            <span className="text-xs text-green-600">Verified</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Phone className="text-purple-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Phone</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedPatient.contactNumber}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 md:col-span-2">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <MapPin className="text-red-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Address</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedPatient.address}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Information */}
                <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">
                    Account Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Calendar className="text-green-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Created</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {new Date(selectedPatient.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Shield className="text-orange-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Status</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedPatient.status}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-gray-300">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">
                    Actions
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetailsModal(false);
                        startEdit(selectedPatient);
                      }}
                      className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Pencil size={16} />
                      Edit Patient
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStatus(selectedPatient.uid, selectedPatient.status);
                      }}
                      className="px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <RefreshCw size={16} />
                      {selectedPatient.status === "Active" ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetailsModal(false);
                        handleDelete(selectedPatient.uid);
                      }}
                      className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Trash2 size={16} />
                      Delete Patient
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-md rounded-md shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-lg font-medium">
                  {editing ? "Edit Patient" : "Add Patient"}
                </h3>
                <div className="text-xs text-gray-500">
                  {editing
                    ? "Update patient information"
                    : "Create new patient account"}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditing(false);
                  setForm(emptyForm);
                  setReturnedLink("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={editing ? handleUpdate : handleCreate}
              className="p-4 space-y-3"
            >
              <div>
                <label className="block text-xs text-gray-600 font-medium mb-1">
                  First name *
                </label>
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={handleFormChange}
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 font-medium mb-1">
                  Last name *
                </label>
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={handleFormChange}
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 font-medium mb-1">
                  Email *
                </label>
                <input
                  name="email"
                  value={form.email}
                  onChange={handleFormChange}
                  type="email"
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                  disabled={editing}
                />
                {editing && (
                  <div className="text-xs text-gray-500 mt-1">
                    Email cannot be changed
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-600 font-medium mb-1">
                  Contact Number *
                </label>
                <input
                  name="contactNumber"
                  value={form.contactNumber}
                  onChange={handleFormChange}
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                  placeholder="+639123456789"
                  maxLength={13}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Format: +63 followed by 10 digits
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 font-medium mb-1">
                  Address *
                </label>
                <input
                  name="address"
                  value={form.address}
                  onChange={handleFormChange}
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                  placeholder="Street, City"
                />
              </div>

              {!editing ? (
                <>
                  <div>
                    <label className="block text-xs text-gray-600 font-medium mb-1">
                      Password *
                    </label>
                    <input
                      name="password"
                      value={form.password}
                      onChange={handleFormChange}
                      type="password"
                      required
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none bg-gray-50 text-sm"
                      placeholder="Auto-generated password"
                      readOnly
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Auto-generated: LastName + Last 4 digits + @abeledo
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 font-medium mb-1">
                      Confirm Password *
                    </label>
                    <input
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={handleFormChange}
                      type="password"
                      required
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none bg-gray-50 text-sm"
                      placeholder="Auto-generated password"
                      readOnly
                    />
                  </div>

                  {/* Password Strength */}
                  <div className="mt-2">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-gray-600 font-medium">
                        Password Strength
                      </span>
                      <span className={`font-semibold ${regScoreInfo.color}`}>
                        {regScoreInfo.text}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`${regScoreInfo.bar} h-full rounded-full transition-all duration-300`}
                        style={{ width: `${regProgress}%` }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      {[
                        { key: "length", label: "8+ characters" },
                        { key: "upper", label: "Uppercase" },
                        { key: "lower", label: "Lowercase" },
                        { key: "number", label: "Numbers" },
                        { key: "special", label: "Symbols" },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              regChecks[item.key] ? "bg-cyan-600" : "bg-gray-300"
                            }`}
                          />
                          <span
                            className={
                              regChecks[item.key]
                                ? "text-gray-700"
                                : "text-gray-400"
                            }
                          >
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                    <div className="font-semibold mb-1">⚠️ Important:</div>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Verification email will be sent to patient</li>
                      <li>Patient must verify email before login</li>
                      <li>You will be signed out after creating account</li>
                      <li>Sign back in as admin to continue</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <div className="font-semibold mb-1">Note:</div>
                  To change email or password for existing patients, use Firebase
                  Console or server-side admin functions.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditing(false);
                    setForm(emptyForm);
                    setReturnedLink("");
                  }}
                  className="px-4 py-2 border rounded text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitLoading
                    ? editing
                      ? "Updating..."
                      : "Creating..."
                    : editing
                    ? "Update Patient"
                    : "Create Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed left-4 bottom-6 z-50">
          <div className="bg-red-600 text-white px-4 py-2 rounded shadow-lg flex items-center gap-3 max-w-md">
            <div className="text-sm">{error}</div>
            <button
              onClick={() => setError("")}
              className="opacity-90 hover:opacity-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}