import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Edit,
  Trash2,
  X,
  CheckCircle,
  RefreshCw,
  User,
  Phone,
  MapPin,
  Mail,
  Shield,
  Calendar
} from "lucide-react";
import { 
  collection, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc,
  setDoc,
  onSnapshot
} from "firebase/firestore";
import { 
  createUserWithEmailAndPassword,
  signOut,
  signInWithEmailAndPassword
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../../../firebase.config";

export default function AdminUser() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Table controls
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [globalSearch, setGlobalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    photoURL: "",
    status: "active",
    currentAdminPassword: ""
  });
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const fileRef = React.useRef(null);

  // Subscribe to realtime admins from Firebase
  useEffect(() => {
    setLoading(true);
    const col = collection(db, "admins");
    const unsub = onSnapshot(
      col,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        arr.sort((a, b) => {
          const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bt - at;
        });
        setAdmins(arr);
        setLoading(false);
      },
      (err) => {
        setError("Subscription error: " + (err?.message || err));
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    let result = admins;

    // Status filter
    if (statusFilter !== "All") {
      result = result.filter((a) => a.status === statusFilter.toLowerCase());
    }

    // Search filter
    const s = globalSearch.trim().toLowerCase();
    if (s) {
      result = result.filter(
        (admin) =>
          (admin.fullName || "").toLowerCase().includes(s) ||
          (admin.email || "").toLowerCase().includes(s) ||
          (admin.contactNumber || "").toLowerCase().includes(s) ||
          (admin.address || "").toLowerCase().includes(s)
      );
    }

    return result;
  }, [admins, globalSearch, statusFilter]);

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
  const allCount = admins.length;
  const activeCount = admins.filter((a) => a.status === "active").length;
  const inactiveCount = admins.filter((a) => a.status === "inactive").length;

  function clearMessages() {
    setError("");
    setSuccessMsg("");
  }

  function handleAddAdmin() {
    setModalMode("add");
    setSelectedAdmin(null);
    setFormData({
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      photoURL: "",
      status: "active",
      currentAdminPassword: ""
    });
    setImageFile(null);
    setImagePreview("");
    setShowModal(true);
  }

  function handleEditAdmin(admin) {
    setModalMode("edit");
    setSelectedAdmin(admin);
    setFormData({
      fullName: admin.fullName || "",
      email: admin.email || "",
      password: "",
      confirmPassword: "",
      photoURL: admin.photoURL || "",
      status: admin.status || "active",
      currentAdminPassword: ""
    });
    setImagePreview(admin.photoURL || "");
    setImageFile(null);
    setShowModal(true);
  }

  function handleAvatarSelect(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (jpg/png).");
      ev.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image too large (max 2MB).");
      ev.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      setImagePreview(base64);
      setFormData(prev => ({ ...prev, photoURL: base64 }));
      setImageFile(file);
    };
    reader.onerror = () => {
      setError("Failed to read image file");
    };
    reader.readAsDataURL(file);

    ev.target.value = "";
  }

  function handleRemoveAvatar() {
    setImagePreview("");
    setFormData(prev => ({ ...prev, photoURL: "" }));
    setImageFile(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearMessages();

    if (!formData.fullName || !formData.email) {
      setError("Please fill in all required fields");
      return;
    }
    
    if (modalMode === "add") {
      if (!formData.password || !formData.confirmPassword) {
        setError("Password is required");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      if (!formData.currentAdminPassword) {
        setError("Please enter admin password to verify");
        return;
      }

      // VERIFY ADMIN PASSWORD FIRST
      setSubmitLoading(true);
      try {
        const currentUserEmail = auth.currentUser?.email;
        if (!currentUserEmail) {
          setError("No admin user is currently signed in");
          setSubmitLoading(false);
          return;
        }

        // Try to sign in with the provided admin password
        await signInWithEmailAndPassword(auth, currentUserEmail, formData.currentAdminPassword);
        
        // If successful, password is correct - proceed with creating new admin
      } catch (verifyError) {
        console.error("Admin password verification failed:", verifyError);
        setSubmitLoading(false);
        
        if (verifyError.code === "auth/wrong-password" || verifyError.code === "auth/invalid-credential") {
          setError("Incorrect admin password. Cannot create new admin account.");
        } else {
          setError("Failed to verify admin password: " + (verifyError.message || "Unknown error"));
        }
        return;
      }
    }
    
    setSubmitLoading(true);
    
    try {
      const photoURL = formData.photoURL; // Already base64 if image selected

      if (modalMode === "add") {
        const currentAdminEmail = auth.currentUser?.email;
        
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        
        const uid = userCredential.user.uid;
        
        const adminData = {
          uid: uid,
          fullName: formData.fullName,
          email: formData.email,
          photoURL: photoURL || "",
          status: "active",
          role: "admin",
          createdAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, "admins", uid), adminData);
        
        const usersData = {
          uid: uid,
          fullName: formData.fullName,
          email: formData.email,
          role: "admin",
          photoURL: photoURL || "",
          status: "active",
          createdAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, "users", uid), usersData);
        
        await signOut(auth);
        
        if (currentAdminEmail && formData.currentAdminPassword) {
          try {
            await signInWithEmailAndPassword(auth, currentAdminEmail, formData.currentAdminPassword);
          } catch (e) {
            console.warn("Could not re-authenticate admin:", e.message);
          }
        }
        
        setSuccessMsg(`Admin account created! Email: ${formData.email}`);
      } else {
        const adminRef = doc(db, "admins", selectedAdmin.uid || selectedAdmin.id);
        await updateDoc(adminRef, {
          fullName: formData.fullName,
          email: formData.email,
          photoURL: photoURL || "",
          updatedAt: new Date().toISOString()
        });
        
        setSuccessMsg("Admin user updated successfully!");
      }
      
      setShowModal(false);
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (error) {
      console.error("Error saving admin:", error);
      if (error.code === "auth/email-already-in-use") {
        setError("Email already in use");
      } else if (error.code === "auth/invalid-email") {
        setError("Invalid email address");
      } else {
        setError("Failed to save admin user");
      }
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleToggleStatus(admin) {
    clearMessages();
    try {
      const newStatus = admin.status === "active" ? "inactive" : "active";
      const adminRef = doc(db, "admins", admin.uid || admin.id);
      await updateDoc(adminRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      setSuccessMsg(`Admin status changed to ${newStatus}`);
      setTimeout(() => setSuccessMsg(""), 2500);
    } catch (error) {
      console.error("Error updating status:", error);
      setError("Failed to update status");
    }
  }

  async function handleDeleteAdmin(admin) {
    if (!window.confirm(`Are you sure you want to delete ${admin.fullName}?`)) return;
    
    try {
      const adminRef = doc(db, "admins", admin.uid || admin.id);
      await deleteDoc(adminRef);
      setSuccessMsg("Admin user deleted successfully");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error) {
      console.error("Error deleting admin:", error);
      setError("Failed to delete admin user");
    }
  }

  function openDetailsModal(admin) {
    setSelectedAdmin(admin);
    setShowDetailsModal(true);
  }

  function getInitials(name) {
    if (!name) return "A";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
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
              onClick={() => setSuccessMsg("")}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Status Cards */}
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
              <div className="text-[10px] text-gray-600 font-semibold mt-1">
                ALL ADMINS
              </div>
            </button>

            <button
              onClick={() => setStatusFilter("active")}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === "active"
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
              onClick={() => setStatusFilter("inactive")}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === "inactive"
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
                placeholder="Search admins..."
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setPage(1);
                }}
                className="border border-gray-400 rounded px-3 py-1 text-xs w-64 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
              />
              <button
                onClick={handleAddAdmin}
                className="bg-red-700 text-white px-3 py-1.5 rounded flex items-center gap-2 hover:bg-red-800 text-xs font-medium"
              >
                <Plus size={14} />
                Add Admin
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
                    <td colSpan={4} className="text-center py-8 text-gray-500">
                      {loading ? "Loading..." : "No admins found"}
                    </td>
                  </tr>
                ) : (
                  paginated.map((admin) => (
                    <tr
                      key={admin.id}
                      onClick={() => openDetailsModal(admin)}
                      className="border-b border-gray-300 hover:bg-blue-50 cursor-pointer transition-colors"
                      title="Click to view details"
                    >
                      <td className="px-3 py-2 border-r border-gray-200">
                        {admin.photoURL ? (
                          <img
                            src={admin.photoURL}
                            alt={admin.fullName}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center text-white font-semibold text-sm shadow">
                            {getInitials(admin.fullName)}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2 border-r border-gray-200">
                        <div className="font-medium text-gray-800">
                          {admin.fullName}
                        </div>
                      </td>

                      <td className="px-3 py-2 border-r border-gray-200">
                        <div className="text-gray-700">{admin.email}</div>
                      </td>

                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            admin.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {admin.status === "active" ? "Active" : "Inactive"}
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
      {showDetailsModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-300 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {selectedAdmin.photoURL ? (
                  <img
                    src={selectedAdmin.photoURL}
                    alt={selectedAdmin.fullName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {getInitials(selectedAdmin.fullName)}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {selectedAdmin.fullName}
                  </h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                      selectedAdmin.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedAdmin.status === "active" ? "Active" : "Inactive"}
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
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Mail className="text-blue-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Email</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedAdmin.email}
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
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Shield className="text-orange-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Role</p>
                        <p className="font-medium text-gray-800 text-sm">
                          Administrator
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Calendar className="text-green-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Created</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedAdmin.createdAt
                            ? new Date(selectedAdmin.createdAt).toLocaleDateString()
                            : "N/A"}
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
                        handleEditAdmin(selectedAdmin);
                      }}
                      className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Edit size={16} />
                      Edit Admin
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(selectedAdmin);
                      }}
                      className="px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <RefreshCw size={16} />
                      {selectedAdmin.status === "active" ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetailsModal(false);
                        handleDeleteAdmin(selectedAdmin);
                      }}
                      className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Trash2 size={16} />
                      Delete Admin
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
                  {modalMode === "add" ? "Add Admin" : "Edit Admin"}
                </h3>
                <div className="text-xs text-gray-500">
                  {modalMode === "add"
                    ? "Create new admin account"
                    : "Update admin information"}
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-600 font-medium mb-1">
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 font-medium mb-1">
                  Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  disabled={modalMode === "edit"}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm disabled:bg-gray-100"
                />
                {modalMode === "edit" && (
                  <div className="text-xs text-gray-500 mt-1">
                    Email cannot be changed
                  </div>
                )}
              </div>

              {modalMode === "add" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 font-medium mb-1">
                        Password <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 font-medium mb-1">
                        Confirm Password <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            confirmPassword: e.target.value,
                          })
                        }
                        required
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 font-medium mb-1">
                      Admin Password <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="password"
                      value={formData.currentAdminPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          currentAdminPassword: e.target.value,
                        })
                      }
                      placeholder="Enter your admin password to verify"
                      required
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Your current admin password is required to create a new admin account
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs text-gray-600 font-medium mb-1">
                  Upload Photo (Optional)
                </label>
                <div className="flex items-start gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileRef}
                    onChange={handleAvatarSelect}
                    className="text-xs flex-1"
                  />
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded border-2 border-gray-300"
                    />
                  ) : selectedAdmin ? (
                    <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-pink-500 rounded border-2 border-gray-300 flex items-center justify-center text-white font-bold text-lg">
                      {getInitials(formData.fullName)}
                    </div>
                  ) : null}
                </div>
                {imagePreview && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove Photo
                    </button>
                  </div>
                )}
              </div>

              {modalMode === "add" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  <div className="font-semibold mb-1">⚠️ Important:</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Your admin password will be verified before creating new admin</li>
                    <li>Admin account will be created in Firebase Auth</li>
                    <li>You will be signed out after creating admin</li>
                    <li>Sign back in with your admin credentials</li>
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-4 py-2 bg-red-700 text-white rounded text-sm hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitLoading
                    ? modalMode === "add"
                      ? "Creating..."
                      : "Updating..."
                    : modalMode === "add"
                    ? "Create Admin"
                    : "Update Admin"}
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